import React, { useEffect, useState } from 'react';
import useMarketStore from '../../store/useMarketStore.js';
import useChartStore from '../../store/useChartStore.js';

export default function BottomBar() {
    const [timeStr, setTimeStr] = useState('');
    const symbol = useChartStore(s => s.activeSymbol);
    const prices = useMarketStore(s => s.prices);
    const wsStatus = useMarketStore(s => s.wsStatus);
    const latency = useMarketStore(s => s.latency);

    const [barCount, setBarCount] = useState(0);

    useEffect(() => {
        const handler = (e) => setBarCount(e.detail);
        window.addEventListener('nexus:bar-count-update', handler);
        return () => window.removeEventListener('nexus:bar-count-update', handler);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const dt = new Date();
            const h = dt.getUTCHours().toString().padStart(2, '0');
            const m = dt.getUTCMinutes().toString().padStart(2, '0');
            const s = dt.getUTCSeconds().toString().padStart(2, '0');
            setTimeStr(`${h}:${m}:${s} (UTC)`);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const data = prices[symbol];
    let spread = '—';
    if (data?.bestAsk && data?.bestBid) {
        const spreadVal = data.bestAsk - data.bestBid;
        spread = spreadVal.toFixed(data.price > 10 ? 2 : 4);
    }

    let dotClass = 'bg-gray-500';
    let latencyColor = 'text-gray-500';

    if (wsStatus === 'connected') {
        dotClass = 'bg-tv-green';
        if (latency < 50) latencyColor = 'text-tv-green';
        else if (latency <= 200) latencyColor = 'text-yellow-500';
        else latencyColor = 'text-tv-red';
    } else if (wsStatus === 'reconnecting') {
        dotClass = 'bg-yellow-500 animate-pulse';
    } else if (wsStatus === 'disconnected') {
        dotClass = 'bg-tv-red';
    }

    return (
        <div className="h-7 bg-tv-panel border-t border-tv-border flex items-center justify-between px-4 text-xs text-gray-400 shrink-0">
            <div className="flex items-center gap-4">
                <span className="font-bold text-gray-300">{symbol}</span>
                <span>Auto (Fits Data)</span>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dotClass}`} title={`Stream: ${wsStatus}`} />
                    {wsStatus === 'connected' && latency > 0 && <span className={latencyColor}>{latency}ms</span>}
                    <span className="text-gray-500 border-l border-tv-border pl-2">Spread: {spread}</span>
                    <span className="text-gray-500 border-l border-tv-border pl-2 tooltip" title="Total Active Bars">{barCount > 0 ? `${barCount} bars` : 'Loading...'}</span>
                </div>
                <span>{timeStr}</span>
            </div>
        </div>
    );
}
