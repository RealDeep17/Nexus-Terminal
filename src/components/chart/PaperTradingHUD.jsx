import React, { useEffect, useState, useRef } from 'react';
import usePaperStore from '../../backtest/store/usePaperStore.js';
import useChartStore from '../../store/useChartStore.js';
import useMarketStore from '../../store/useMarketStore.js';

export default function PaperTradingHUD() {
    const { isActive, position, initialCapital, equity: storeEquity, stopPaper } = usePaperStore();
    const { activeSymbol, timeframe } = useChartStore();

    // Live tick counter for re-rendering
    const [, setTickCount] = useState(0);
    const [livePrice, setLivePrice] = useState(null);

    // Draggable state
    const [pos, setPos] = useState({ left: 10, bottom: 40 });
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const onTick = (e) => {
            setLivePrice(e.detail.close);
            setTickCount(c => c + 1);
        };
        window.addEventListener('nexus:paper-tick', onTick);
        return () => window.removeEventListener('nexus:paper-tick', onTick);
    }, []);

    const onMouseDown = (e) => {
        isDragging.current = true;
        dragOffset.current = {
            x: e.clientX - pos.left,
            y: window.innerHeight - e.clientY - pos.bottom
        };
    };

    useEffect(() => {
        const onMouseMove = (e) => {
            if (!isDragging.current) return;
            // clamp
            const newLeft = Math.max(0, e.clientX - dragOffset.current.x);
            // bottom logic is tricky with window height, let's just stick to window coords
            const newBottom = Math.max(0, window.innerHeight - e.clientY - dragOffset.current.y);
            setPos({ left: newLeft, bottom: newBottom });
        };
        const onMouseUp = () => { isDragging.current = false; };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    if (!isActive) return null;

    // Use live price if we saw a tick, otherwise fallback to market store
    const price = livePrice || useMarketStore.getState().prices[activeSymbol]?.price || 0;

    // Calculate Unrealized
    let unrealizedPnl = 0;
    let unrealizedPct = 0;
    if (position && price) {
        const diff = (price - position.entryPrice) * (position.dir === 'long' ? 1 : -1);
        unrealizedPnl = diff * position.qty;
        unrealizedPct = (unrealizedPnl / (position.entryPrice * position.qty)) * 100;
    }

    const equity = storeEquity + unrealizedPnl;
    const equityColor = equity >= initialCapital ? 'text-tv-green' : 'text-tv-red';
    const isProfitable = unrealizedPnl >= 0;

    return (
        <div
            className="absolute z-20 w-[240px] bg-tv-panel/95 backdrop-blur border border-tv-border rounded shadow-2xl flex flex-col text-[11px]"
            style={{ left: pos.left, bottom: pos.bottom }}
        >
            {/* Header / Drag Handle */}
            <div
                className="flex items-center gap-2 px-3 py-1.5 border-b border-tv-border bg-black/20 cursor-move select-none"
                onMouseDown={onMouseDown}
            >
                <div className="w-2 h-2 rounded-full bg-tv-blue animate-pulse shrink-0" />
                <span className="font-bold text-gray-200">PAPER</span>
                <span className="text-gray-400 ml-auto">{activeSymbol} {timeframe}</span>
            </div>

            <div className="p-3 flex flex-col gap-2">
                {/* Equity Line */}
                <div className="flex items-baseline justify-between">
                    <span className="text-tv-muted">Equity</span>
                    <span className={`font-mono font-bold text-sm ${equityColor}`}>
                        ${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>

                {/* Position Info */}
                <div className="bg-black/10 rounded p-2 border border-tv-border">
                    {position ? (
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${position.dir === 'long' ? 'bg-tv-green/20 text-tv-green border-tv-green/30' : 'bg-tv-red/20 text-tv-red border-tv-red/30'}`}>
                                    {position.dir.toUpperCase()}
                                </span>
                                <span className="font-mono text-gray-300">
                                    {position.qty} {activeSymbol.replace('USDT', '')}
                                </span>
                            </div>
                            <div className="text-gray-400 font-mono">
                                @ ${position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-tv-muted italic text-xs py-1">Flat — No Position</div>
                    )}
                </div>

                {/* Unrealized PnL */}
                {position && (
                    <div className="flex items-center justify-between font-mono">
                        <span className="text-tv-muted">Unrealized:</span>
                        <span className={isProfitable ? 'text-tv-green' : 'text-tv-red'}>
                            {isProfitable ? '+' : ''}${unrealizedPnl.toFixed(2)} ({isProfitable ? '+' : ''}{unrealizedPct.toFixed(2)}%)
                        </span>
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2 mt-1">
                    <button
                        onClick={stopPaper}
                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-tv-red border border-red-500/20 py-1 rounded transition-colors"
                    >
                        ■ Stop
                    </button>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('nexus:open-backtest'))}
                        className="flex-1 bg-tv-blue/10 hover:bg-tv-blue/20 text-tv-blue border border-tv-blue/20 py-1 rounded transition-colors"
                    >
                        + Position
                    </button>
                </div>
            </div>
        </div>
    );
}
