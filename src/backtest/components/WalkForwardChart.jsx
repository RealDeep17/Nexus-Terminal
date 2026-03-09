import React from 'react';

// For brevity, similar to heatmap or stacked bar charts showing Train VS Test periods.
export default function WalkForwardChart({ windows }) {
    if (!windows || windows.length === 0) {
        return (
            <div className="p-8 text-center text-text-muted text-[13px]">
                No Walk-Forward Analysis available. Enable it in Optimization settings.
            </div>
        );
    }

    // Expects windows: [{ id: 1, trainStart: '..', trainEnd, testStart, testEnd, trainPnL, testPnL, efficiency }]
    const maxScore = Math.max(...windows.map(w => Math.max(Math.abs(w.trainPnL || 0), Math.abs(w.testPnL || 0))));

    const DateFmt = (ts) => new Date(ts).toLocaleDateString([], { month: 'short', year: '2-digit' });

    return (
        <div className="w-full h-full p-4 overflow-y-auto bg-bg-app">
            <div className="text-[12px] font-medium text-text-primary mb-4 p-3 border border-border-default bg-bg-panel rounded-[3px]">
                Walk-Forward Analysis splits historical data into overlapping training and testing segments to evaluate strategy robustness and prevent curve-fitting.
            </div>

            <div className="flex flex-col space-y-4">
                {windows.map(w => {
                    const trainWidth = `${Math.max(5, (Math.abs(w.trainPnL) / maxScore) * 100)}%`;
                    const testWidth = `${Math.max(5, (Math.abs(w.testPnL) / maxScore) * 100)}%`;

                    return (
                        <div key={w.id} className="bg-bg-panel border border-border-default rounded-[3px] p-3 flex flex-col">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[12px] font-bold text-text-primary uppercase tracking-wide">Fold {w.id}</span>
                                <span className="text-[11px] text-text-secondary">WFA Efficiency: <span className={`font-bold tabular-nums ${w.efficiency > 0.5 ? 'text-tv-green' : 'text-tv-red'}`}>{w.efficiency?.toFixed(2) || '0.00'}</span></span>
                            </div>

                            {/* Timeline layout */}
                            <div className="grid grid-cols-[80px_1fr] gap-2 items-center mb-1">
                                <span className="text-[11px] text-text-secondary text-right">In-Sample</span>
                                <div className="w-full bg-bg-input h-[20px] rounded-[2px] relative flex shadow-inner">
                                    <div
                                        className={`h-full ${w.trainPnL >= 0 ? 'bg-tv-blue' : 'bg-tv-red'} rounded-[2px] transition-all duration-500`}
                                        style={{ width: trainWidth }}
                                    />
                                    <span className="absolute px-2 text-[10px] text-white font-bold h-full flex items-center">{w.trainPnL?.toFixed(2)}%</span>
                                </div>
                                <div className="col-start-2 text-[9px] text-text-muted mt-[-2px]">{DateFmt(w.trainStart)} → {DateFmt(w.trainEnd)}</div>
                            </div>

                            <div className="grid grid-cols-[80px_1fr] gap-2 items-center mt-2">
                                <span className="text-[11px] text-text-secondary text-right">Out-of-Sample</span>
                                <div className="w-full bg-bg-input h-[20px] rounded-[2px] relative flex shadow-inner">
                                    <div
                                        className={`h-full ${w.testPnL >= 0 ? 'bg-tv-green' : 'bg-tv-red'} rounded-[2px] transition-all duration-500`}
                                        style={{ width: testWidth }}
                                    />
                                    <span className="absolute px-2 text-[10px] text-white font-bold h-full flex items-center">{w.testPnL?.toFixed(2)}%</span>
                                </div>
                                <div className="col-start-2 text-[9px] text-text-muted mt-[-2px]">{DateFmt(w.testStart)} → {DateFmt(w.testEnd)}</div>
                            </div>

                        </div>
                    );
                })}
            </div>
        </div>
    );
}
