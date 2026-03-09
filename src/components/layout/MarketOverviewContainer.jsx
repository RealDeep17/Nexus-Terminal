import React, { useEffect, useState, useRef } from 'react';
import useMultiChartStore from '../../store/useMultiChartStore.js';
import useChartStore from '../../store/useChartStore.js';

const TOP_10 = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

export default function MarketOverviewContainer() {
    const [data, setData] = useState({});

    // Quick polling fetching
    useEffect(() => {
        let active = true;
        const fetchAll = async () => {
            try {
                const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
                const list = await res.json();
                if (!active || !Array.isArray(list)) return;

                const map = {};
                for (const t of list) {
                    if (TOP_10.includes(t.symbol)) {
                        map[t.symbol] = {
                            price: parseFloat(t.lastPrice),
                            change: parseFloat(t.priceChangePercent),
                            volume: parseFloat(t.quoteVolume)
                        };
                    }
                }
                setData(map);
            } catch (err) { }
        };

        fetchAll();
        const intv = setInterval(fetchAll, 5000); // 5 seconds
        return () => { active = false; clearInterval(intv); };
    }, []);

    // Also fetch 20-candle history for sparklines
    const [history, setHistory] = useState({});
    useEffect(() => {
        let active = true;
        TOP_10.forEach(async (sym) => {
            try {
                const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=1m&limit=20`);
                const klines = await res.json();
                if (!active) return;
                const closes = klines.map(k => parseFloat(k[4]));
                setHistory(prev => ({ ...prev, [sym]: closes }));
            } catch (err) { }
        });
        return () => { active = false; };
    }, []);

    const layoutId = useMultiChartStore(s => s.layoutId);
    const focusedTarget = useMultiChartStore(s => s.focusedTarget);

    const handleSetSymbol = (sym) => {
        if (layoutId !== '1') useMultiChartStore.getState().updateChart(focusedTarget, { symbol: sym });
        useChartStore.getState().setSymbol(sym);
    };

    return (
        <div className="h-10 bg-tv-bg border-b border-tv-border flex items-center overflow-x-auto no-scrollbar shrink-0 px-2 space-x-2">
            {TOP_10.map(sym => {
                const d = data[sym] || {};
                const h = history[sym] || [];
                const isUp = d.change >= 0;

                return (
                    <div
                        key={sym}
                        onClick={() => handleSetSymbol(sym)}
                        className="flex items-center space-x-2 bg-tv-panel border border-tv-border hover:border-tv-blue rounded px-3 py-1 cursor-pointer shrink-0 transition-colors group"
                    >
                        <span className="font-bold text-gray-200 text-xs">{sym.replace('USDT', '')}</span>
                        <span className="text-gray-300 font-mono text-xs tabular-nums">{d.price ? d.price.toFixed(d.price < 1 ? 4 : 2) : '—'}</span>
                        <span className={`text-[10px] font-bold px-1 rounded ${isUp ? 'text-tv-green bg-tv-green/10' : 'text-tv-red bg-tv-red/10'}`}>
                            {isUp ? '+' : ''}{d.change ? d.change.toFixed(2) : '0.00'}%
                        </span>
                        <div className="w-[40px] h-[16px]">
                            <Sparkline history={h} isUp={isUp} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Sparkline({ history, isUp }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (!history || history.length < 2) return;

        const min = Math.min(...history);
        const max = Math.max(...history);
        const range = max - min || 1;

        ctx.strokeStyle = isUp ? '#26a69a' : '#ef5350';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        history.forEach((val, i) => {
            const x = (i / (history.length - 1)) * w;
            const y = h - ((val - min) / range) * h;
            const paddedY = 2 + (y * ((h - 4) / h));
            if (i === 0) ctx.moveTo(x, paddedY);
            else ctx.lineTo(x, paddedY);
        });
        ctx.stroke();
    }, [history, isUp]);

    return <canvas ref={canvasRef} width={40} height={16} className="opacity-80 group-hover:opacity-100 transition-opacity" />;
}
