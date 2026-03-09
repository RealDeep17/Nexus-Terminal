import React from 'react';
import useBacktestStore from '../store/useBacktestStore.js';

export default function MetricsDashboard() {
    const { lastResult } = useBacktestStore();

    if (!lastResult) {
        return (
            <div className="p-8 text-center text-text-muted text-[13px]">
                No metrics available. Run a backtest first.
            </div>
        );
    }

    const m = lastResult.summary;

    const StatBox = ({ label, value, colorClass = "text-text-primary", subtext }) => (
        <div className="flex flex-col p-4 bg-tv-panel border border-tv-border rounded-[4px]">
            <span className="text-[11px] text-tv-muted uppercase font-medium tracking-wide mb-1">{label}</span>
            <span className={`text-[20px] font-semibold tabular-nums leading-none ${colorClass}`}>
                {value}
            </span>
            {subtext && <span className="text-[11px] text-text-muted mt-2 leading-none">{subtext}</span>}
        </div>
    );

    return (
        <div className="w-full h-full overflow-y-auto no-scrollbar p-4 bg-tv-bg">

            <div className="grid grid-cols-4 gap-4 mb-4">
                <StatBox
                    label="Net Profit"
                    value={`${m.netProfitPct > 0 ? '+' : ''}${m.netProfitPct.toFixed(2)}%`}
                    colorClass={m.netProfitPct > 0 ? "text-tv-green" : "text-tv-red"}
                    subtext={`$${m.netProfit.toFixed(2)}`}
                />
                <StatBox
                    label="Total Trades"
                    value={m.totalTrades}
                    subtext={`${m.winCount} won, ${m.lossCount} lost`}
                />
                <StatBox
                    label="Percent Profitable"
                    value={`${m.winRate.toFixed(2)}%`}
                    colorClass={m.winRate > 50 ? "text-tv-green" : "text-text-primary"}
                />
                <StatBox
                    label="Profit Factor"
                    value={m.profitFactor.toFixed(3)}
                    colorClass={m.profitFactor > 1.5 ? "text-tv-green" : m.profitFactor < 1 ? "text-tv-red" : "text-text-primary"}
                />
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
                <StatBox
                    label="Max Drawdown"
                    value={`${m.maxDrawdown.toFixed(2)}%`}
                    colorClass="text-tv-red"
                    subtext="Peak to trough depth"
                />
                <StatBox
                    label="Sharpe Ratio"
                    value={m.sharpe.toFixed(3)}
                    subtext="Risk-adjusted return"
                />
                <StatBox
                    label="Average Trade"
                    value={`${m.avgTradePct > 0 ? '+' : ''}${m.avgTradePct.toFixed(2)}%`}
                    colorClass={m.avgTradePct > 0 ? "text-tv-green" : "text-tv-red"}
                    subtext={`$${m.avgTrade.toFixed(2)}`}
                />
                <StatBox
                    label="Buy & Hold Return"
                    value={`${m.buyAndHoldReturnPct > 0 ? '+' : ''}${m.buyAndHoldReturnPct.toFixed(2)}%`}
                    colorClass={m.buyAndHoldReturnPct > 0 ? "text-tv-green" : "text-tv-red"}
                />
            </div>

            {/* Advanced Metrics Table */}
            <div className="bg-tv-panel border border-tv-border rounded-[4px] overflow-hidden">
                <div className="px-4 py-2 bg-bg-input border-b border-tv-border text-[12px] font-semibold">
                    Advanced Statistics
                </div>
                <div className="grid grid-cols-2 text-[12px]">
                    <div className="border-r border-tv-border">
                        <Row label="Gross Profit" val={`$${m.grossProfit.toFixed(2)}`} col="text-tv-green" />
                        <Row label="Gross Loss" val={`$${m.grossLoss.toFixed(2)}`} col="text-tv-red" />
                        <Row label="Largest Win" val={`$${m.largestWin.toFixed(2)}`} col="text-tv-green" />
                        <Row label="Largest Loss" val={`$${m.largestLoss.toFixed(2)}`} col="text-tv-red" />
                        <Row label="Max Consecutive Wins" val={m.maxConsecWins} />
                        <Row label="Max Consecutive Losses" val={m.maxConsecLosses} />
                    </div>
                    <div>
                        <Row label="Sortino Ratio" val={m.sortino.toFixed(3)} />
                        <Row label="Calmar Ratio" val={m.calmar.toFixed(3)} />
                        <Row label="Ulcer Index" val={m.ulcerIndex?.toFixed(3) || '0.000'} />
                        <Row label="Value at Risk (95%)" val={`${m.var95?.toFixed(2) || '0.00'}%`} col="text-tv-red" />
                        <Row label="Avg Bars in Trade" val={m.avgBarsInTrade?.toFixed(1) || '0.0'} />
                        <Row label="Kelly Target %" val={`${(m.kellyFactor * 100).toFixed(2)}%`} />
                    </div>
                </div>
            </div>

        </div>
    );
}

const Row = ({ label, val, col = 'text-text-primary' }) => (
    <div className="flex justify-between items-center px-4 py-2 border-b border-tv-border hover:bg-tv-hover last:border-0">
        <span className="text-tv-muted">{label}</span>
        <span className={`tabular-nums font-medium ${col}`}>{val}</span>
    </div>
);
