import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import useBacktestStore from '../store/useBacktestStore.js';
import usePaperStore from '../store/usePaperStore.js';

export default function EquityCurveChart({ isPaper = false }) {
    const chartContainerRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const { lastResult } = useBacktestStore();
    const { equityCurve: paperCurve } = usePaperStore();

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Exact TradingView tokens matching spec
        const colors = {
            bg: '#131722',
            text: '#787b86',
            grid: 'rgba(255,255,255,0.04)',
            line: '#2962ff',
            areaTop: 'rgba(41,98,255,0.3)',
            areaBottom: 'rgba(41,98,255,0.0)',
            bhLine: '#ff9800',
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: 'solid', color: colors.bg },
                textColor: colors.text,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
            },
            grid: {
                vertLines: { color: colors.grid },
                horzLines: { color: colors.grid },
            },
            rightPriceScale: {
                borderVisible: false,
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
                borderVisible: false,
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: 1, // Normal crosshair
                vertLine: {
                    color: 'rgba(255,255,255,0.2)',
                    style: 3,
                    labelBackgroundColor: colors.text
                },
                horzLine: {
                    color: 'rgba(255,255,255,0.2)',
                    style: 3,
                    labelBackgroundColor: colors.text
                },
            },
            autoSize: true,
        });

        chartInstanceRef.current = chart;

        const areaSeries = chart.addAreaSeries({
            lineColor: colors.line,
            topColor: colors.areaTop,
            bottomColor: colors.areaBottom,
            lineWidth: 2,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        });

        // Buy & Hold comparison line
        const bhSeries = chart.addLineSeries({
            color: colors.bhLine,
            lineWidth: 1,
            lineStyle: 1, // dashed
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        });

        if (!isPaper && lastResult && lastResult.equityCurve) {
            // Map backtest engine data to LightweightCharts format
            // LightweightCharts requires time in unix timestamp (seconds) or string 'YYYY-MM-DD'
            const eqData = lastResult.equityCurve.map(p => ({
                time: p.time / 1000,
                value: p.equity
            }));
            areaSeries.setData(eqData);

            if (lastResult.buyAndHoldCurve) {
                const bhData = lastResult.buyAndHoldCurve.map(p => ({
                    time: p.time / 1000,
                    value: p.equity
                }));
                bhSeries.setData(bhData);
            }

            chart.timeScale().fitContent();
        } else if (isPaper && paperCurve && paperCurve.length > 0) {
            const eqData = paperCurve.map(p => ({
                time: p.time, // PaperTrader equityCurve time is already seconds
                value: p.equity
            }));
            areaSeries.setData(eqData);
            chart.timeScale().fitContent();
        } else {
            // Dummy data just for visual setup before run
            const dummy = [];
            let val = 10000;
            let t = Date.now() / 1000 - 86400 * 100;
            for (let i = 0; i < 100; i++) {
                val += (Math.random() - 0.48) * 100;
                dummy.push({ time: t + i * 86400, value: val });
            }
            areaSeries.setData(dummy);
            chart.timeScale().fitContent();
        }

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.remove();
            }
        };
    }, [lastResult]);

    return (
        <div className="w-full h-full p-2">
            <div
                ref={chartContainerRef}
                className="w-full h-full overflow-hidden border border-tv-border rounded-[3px]"
            />
        </div>
    );
}
