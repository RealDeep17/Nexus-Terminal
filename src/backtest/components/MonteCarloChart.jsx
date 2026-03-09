import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import useBacktestStore from '../store/useBacktestStore.js';

export default function MonteCarloChart() {
    const chartContainerRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const { lastResult } = useBacktestStore();

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Very dim grid lines to match TV dense view
        const colors = {
            bg: '#131722',
            text: '#787b86',
            grid: 'rgba(255,255,255,0.04)',
        };

        const chart = createChart(chartContainerRef.current, {
            layout: { background: { type: 'solid', color: colors.bg }, textColor: colors.text, fontFamily: 'sans-serif' },
            grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
            rightPriceScale: { borderVisible: false },
            timeScale: { borderVisible: false, timeVisible: false }, // X axis is just trade number (index)
            crosshair: { mode: 1 },
            autoSize: true,
        });

        chartInstanceRef.current = chart;

        const mcData = lastResult?.monteCarlo;
        if (mcData && mcData.sampleCurves) {
            // Draw 100 sample curves as very thin, faint lines
            mcData.sampleCurves.forEach((mcRun, idx) => {
                const isHighlight = idx === 50; // highlight the median
                const series = chart.addLineSeries({
                    color: isHighlight ? '#2962ff' : 'rgba(120,123,134, 0.15)', // light grey lines
                    lineWidth: isHighlight ? 2 : 1,
                    crosshairMarkerVisible: false,
                    priceLineVisible: false,
                    lastValueVisible: false,
                });

                const data = mcRun.curve.map((val, i) => ({
                    // Lightweight charts integer timestamps represent seconds. 
                    time: i + 1,
                    value: val
                }));

                series.setData(data);
            });
            chart.timeScale().fitContent();
        } else {
            // Placeholder lines
            for (let j = 0; j < 20; j++) {
                const series = chart.addLineSeries({ color: 'rgba(120,123,134, 0.1)', lineWidth: 1 });
                const data = [];
                let val = 10000;
                for (let i = 1; i <= 100; i++) {
                    val += (Math.random() - 0.48) * 50;
                    data.push({ time: i, value: val });
                }
                series.setData(data);
            }
            chart.timeScale().fitContent();
        }

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.remove();
            }
        };
    }, [lastResult]);

    const stats = lastResult?.monteCarlo?.stats;

    return (
        <div className="flex h-full p-2 space-x-2 bg-bg-app">
            <div className="flex-1 border border-border-default rounded-[3px] overflow-hidden">
                <div ref={chartContainerRef} className="w-full h-full" />
            </div>

            {/* Sidebar stats */}
            <div className="w-[200px] flex flex-col space-y-2 shrink-0">
                <div className="bg-bg-panel border border-border-default p-3 rounded-[3px]">
                    <div className="text-[11px] uppercase font-medium text-text-secondary mb-2">Confidence Intervals</div>
                    <div className="text-[12px] text-text-primary flex justify-between"><span>5th Percentile</span> <span>${stats?.p5Equity?.toFixed(0) || '-'}</span></div>
                    <div className="text-[12px] text-tv-blue font-bold flex justify-between mt-1"><span>Median</span> <span>${stats?.medianEquity?.toFixed(0) || '-'}</span></div>
                    <div className="text-[12px] text-text-primary flex justify-between mt-1"><span>95th Percentile</span> <span>${stats?.p95Equity?.toFixed(0) || '-'}</span></div>
                </div>

                <div className="bg-bg-panel border border-border-default p-3 rounded-[3px]">
                    <div className="text-[11px] uppercase font-medium text-text-secondary mb-2">Drawdown Risks</div>
                    <div className="text-[12px] text-text-primary flex justify-between"><span>Median DD</span> <span className="text-tv-red">{stats?.medianDD?.toFixed(1) || '-'}%</span></div>
                    <div className="text-[12px] text-text-primary flex justify-between mt-1"><span>Max Exper. DD</span> <span className="text-tv-red font-bold">{stats?.maxDD?.toFixed(1) || '-'}%</span></div>
                    <div className="text-[12px] text-text-primary flex justify-between mt-2 pt-2 border-t border-border-default">
                        <span>Risk of Ruin</span>
                        <span className={`${stats?.riskOfRuin > 10 ? 'text-tv-red' : 'text-tv-green'} font-bold`}>{stats?.riskOfRuin?.toFixed(1) || '-'}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
