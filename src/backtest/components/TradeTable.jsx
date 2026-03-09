import React from 'react';
import useBacktestStore from '../store/useBacktestStore.js';
import usePaperStore from '../store/usePaperStore.js';

export default function TradeTable({ isPaper = false }) {
    const { lastResult } = useBacktestStore();
    const { trades: paperTrades } = usePaperStore();

    let rawTrades = isPaper ? paperTrades : (lastResult?.trades || []);
    const trades = isPaper ? rawTrades.map(t => ({
        id: t.id,
        direction: t.dir.toUpperCase(),
        entryTime: t.entryTime,
        entryPrice: t.entryPrice,
        exitTime: t.exitTime,
        exitPrice: t.exitPrice,
        size: t.qty,
        netPnl: t.pnl,
        returnPct: t.pnlPct
    })).reverse() : rawTrades;

    return (
        <div className="flex flex-col h-full bg-tv-bg border-l border-tv-border overflow-hidden">

            {/* Table Header */}
            <div className="flex h-[32px] items-center px-4 bg-tv-panel border-b border-tv-border text-[11px] uppercase font-medium tracking-wide text-tv-muted w-full shrink-0">
                <div className="w-16">Trade #</div>
                <div className="w-16">Side</div>
                <div className="flex-1">Entry Time</div>
                <div className="w-24 text-right">Entry Price</div>
                <div className="flex-1">Exit Time</div>
                <div className="w-24 text-right">Exit Price</div>
                <div className="w-20 text-right">Size</div>
                <div className="w-24 text-right">Net PnL</div>
                <div className="w-24 text-right">% Return</div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
                {trades.length === 0 ? (
                    <div className="p-8 text-center text-text-muted text-[13px]">
                        No trades available. Run a backtest first.
                    </div>
                ) : (
                    trades.map((trade, i) => {
                        const isProfit = trade.netPnl > 0;
                        return (
                            <div
                                key={trade.id}
                                className="flex items-center px-4 h-[32px] border-b border-tv-border hover:bg-tv-hover text-[12px] tabular-nums text-text-primary"
                            >
                                <div className="w-16 text-text-muted">{i + 1}</div>
                                <div className={`w-16 font-medium ${trade.direction === 'LONG' ? 'text-tv-green' : 'text-tv-red'}`}>
                                    {trade.direction}
                                </div>
                                <div className="flex-1 text-tv-muted">{new Date(trade.entryTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                <div className="w-24 text-right">{trade.entryPrice.toFixed(2)}</div>
                                <div className="flex-1 text-tv-muted">{trade.exitTime ? new Date(trade.exitTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Open'}</div>
                                <div className="w-24 text-right">{trade.exitPrice?.toFixed(2) || '-'}</div>
                                <div className="w-20 text-right">{trade.size.toFixed(4)}</div>

                                <div className={`w-24 text-right font-medium ${isProfit ? 'text-tv-green' : 'text-tv-red'}`}>
                                    {trade.netPnl > 0 ? '+' : ''}{trade.netPnl.toFixed(2)}
                                </div>

                                <div className={`w-24 text-right font-medium ${isProfit ? 'text-tv-green' : 'text-tv-red'}`}>
                                    {trade.netPnl > 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

        </div>
    );
}
