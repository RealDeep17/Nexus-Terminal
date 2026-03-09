import React, { useState } from 'react';
import usePaperStore from '../../backtest/store/usePaperStore.js';
import useMarketStore from '../../store/useMarketStore.js';
import useChartStore from '../../store/useChartStore.js';

export default function ManualOrderPanel() {
    const { isActive, position, executeManualOrder, closePosition } = usePaperStore();
    const activeSymbol = useChartStore(s => s.activeSymbol);
    const priceObj = useMarketStore(s => s.prices[activeSymbol]);
    const currentPrice = priceObj?.price || 0;

    const [qtyString, setQtyString] = useState('1');

    if (!isActive) return null;

    const handleBuy = () => {
        const qty = parseFloat(qtyString);
        if (qty > 0) executeManualOrder('long', qty);
    };

    const handleSell = () => {
        const qty = parseFloat(qtyString);
        if (qty > 0) executeManualOrder('short', qty);
    };

    return (
        <div className="absolute top-16 right-4 z-[40] w-64 bg-tv-panel border border-tv-border shadow-2xl rounded text-tv-text flex flex-col pointer-events-auto">
            <div className="p-2 border-b border-tv-border flex items-center justify-between shrink-0 bg-tv-bg rounded-t">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Manual Order</span>
                <span className="text-xs font-mono font-bold text-gray-400">{activeSymbol}</span>
            </div>

            <div className="p-3 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider">Quantity</label>
                    <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={qtyString}
                        onChange={e => setQtyString(e.target.value)}
                        className="tv-input text-sm font-mono w-full"
                    />
                </div>

                {!position ? (
                    <div className="flex gap-2">
                        <button onClick={handleBuy} className="flex-1 bg-tv-green hover:bg-green-600 text-white font-bold py-2 rounded transition-colors text-sm shadow-md">
                            Buy Mkt
                        </button>
                        <button onClick={handleSell} className="flex-1 bg-tv-red hover:bg-red-600 text-white font-bold py-2 rounded transition-colors text-sm shadow-md">
                            Sell Mkt
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center bg-tv-bg p-2 rounded border border-tv-border">
                            <div className="flex flex-col">
                                <span className={`text-[10px] uppercase font-bold ${position.dir === 'long' ? 'text-tv-green' : 'text-tv-red'}`}>{position.dir} {position.qty.toFixed(4)}</span>
                                <span className="text-xs font-mono text-gray-400">@ {position.entryPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[10px] text-gray-500 uppercase">Unrealized PnL</span>
                                <span className={`text-sm font-bold tabular-nums ${position.currentPnl >= 0 ? 'text-tv-green' : 'text-tv-red'}`}>
                                    {position.currentPnl >= 0 ? '+' : ''}{position.currentPnl?.toFixed(2) || '0.00'}
                                </span>
                            </div>
                        </div>
                        <button onClick={() => closePosition()} className="w-full bg-tv-bg border border-tv-border hover:bg-tv-hover hover:border-tv-blue text-white font-bold py-2 rounded transition-colors text-sm text-center">
                            Close Position
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
