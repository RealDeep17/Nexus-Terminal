import React from 'react';

// Basic Optimization Heatmap rendering a grid of parameter combinations
export default function OptimizationHeatmap({ optimizationResults }) {

    if (!optimizationResults || optimizationResults.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 text-text-muted text-[13px]">
                No optimization data available. Run an optimization sequence in the builder.
            </div>
        );
    }

    // Extract the top 2 parameters dynamically to form a 2D grid matrix
    // For simplicity, we just take the first two keys in the params object of the first result
    const paramsKeys = Object.keys(optimizationResults[0].params);
    if (paramsKeys.length < 2) {
        return <div className="p-4 text-text-primary">Heatmap requires at least 2 parameters being optimized.</div>;
    }

    const keyX = paramsKeys[0];
    const keyY = paramsKeys[1];

    // Get unique sorted values for X and Y axes
    const uX = Array.from(new Set(optimizationResults.map(r => r.params[keyX]))).sort((a, b) => a - b);
    const uY = Array.from(new Set(optimizationResults.map(r => r.params[keyY]))).sort((a, b) => a - b);

    // Find min/max scores to normalize heatmap colors
    const maxScore = Math.max(...optimizationResults.map(r => r.score));
    const minScore = Math.min(...optimizationResults.map(r => r.score));
    const range = maxScore - minScore || 1;

    // Simple TV Blue to Red/Green color mapping
    const getColor = (score) => {
        // If score is profit based, >0 green, <0 red
        if (score > 0) {
            const intensity = Math.min(1, score / maxScore);
            return `rgba(38, 166, 154, ${intensity * 0.8})`; // tv-green
        } else {
            const intensity = Math.min(1, Math.abs(score) / Math.abs(minScore));
            return `rgba(239, 83, 80, ${intensity * 0.8})`; // tv-red
        }
    };

    return (
        <div className="w-full h-full p-4 overflow-auto bg-bg-app flex flex-col items-center justify-center">
            <div className="mb-4 text-center">
                <h3 className="text-[14px] font-medium text-text-primary mb-1">Optimization Heatmap</h3>
                <p className="text-[12px] text-text-secondary">Y: {keyY} / X: {keyX}</p>
            </div>

            <div className="relative inline-flex flex-col border-l border-b border-border-default">
                {uY.map((yVal, i) => (
                    <div key={yVal} className="flex">
                        {/* Y axis label */}
                        <div className="w-[60px] flex items-center justify-end pr-2 text-[10px] text-text-secondary absolute left-[-60px]" style={{ height: '30px', top: i * 30 }}>
                            {yVal}
                        </div>

                        {uX.map(xVal => {
                            const res = optimizationResults.find(r => r.params[keyX] === xVal && r.params[keyY] === yVal);
                            const score = res ? res.score : 0;
                            return (
                                <div
                                    key={`${xVal}-${yVal}`}
                                    className="w-[40px] h-[30px] border-r border-t border-[rgba(255,255,255,0.02)] flex items-center justify-center group relative cursor-pointer"
                                    style={{ backgroundColor: getColor(score) }}
                                >
                                    <span className="text-[9px] text-white opacity-0 group-hover:opacity-100 mix-blend-difference z-10">{score.toFixed(1)}</span>

                                    {/* Tooltip */}
                                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 p-2 bg-bg-tooltip text-white text-[11px] rounded-[3px] shadow-lg whitespace-nowrap z-50">
                                        {keyY}: {yVal}<br />
                                        {keyX}: {xVal}<br />
                                        <span className="font-bold text-tv-blue mt-1 inline-block">Score: {score.toFixed(2)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}

                {/* X axis labels */}
                <div className="flex border-t border-border-default absolute bottom-[-20px] left-0">
                    {uX.map(xVal => (
                        <div key={xVal} className="w-[40px] text-center text-[10px] text-text-secondary pt-1 pr-[1px]">
                            {xVal}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
