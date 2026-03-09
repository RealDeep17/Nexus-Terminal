import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import useChartStore from '../../store/useChartStore.js';
import useMarketStore from '../../store/useMarketStore.js';
import useAlertStore from '../../engine/alerts/useAlertStore.js';
import usePaperStore from '../../backtest/store/usePaperStore.js';
import useReplayStore from '../../store/useReplayStore.js';
import PaperTradingHUD from './PaperTradingHUD.jsx';
import ManualOrderPanel from './ManualOrderPanel.jsx';
import DrawingCanvas from './DrawingCanvas.jsx';
import ReplayController from './ReplayController.jsx';
import { fetchLatestBars, fetchBackfill, fetchOlderBars, mergeAndSort } from '../../api/binance.js';
import useMultiChartStore from '../../store/useMultiChartStore.js';
import { computeAllIndicators } from '../../indicators/index.js';
import useSettingsStore from '../../store/useSettingsStore.js';

// ─── How many bars to show on initial fast load ───────────────────────────────
const PHASE1_BARS = 200;

// ─── Left-edge threshold: fire Phase 3 when this many bars remain on the left ─
const SCROLL_TRIGGER_BARS = 1000;

export default function MainChart({ instanceId = 'main' }) {
    // Legacy store access (used when in single-chart mode)
    const legacySymbol = useChartStore(s => s.activeSymbol);
    const legacyTf = useChartStore(s => s.timeframe);

    // Multi-chart store access
    const isMultiChartActive = useMultiChartStore(s => s.layoutId !== '1');
    const multiStoreData = useMultiChartStore(s => s.charts[instanceId]);
    const focusedTarget = useMultiChartStore(s => s.focusedTarget);
    const setFocus = useMultiChartStore(s => s.setFocus);

    const activeSymbol = (isMultiChartActive && multiStoreData) ? multiStoreData.symbol : legacySymbol;
    const timeframe = (isMultiChartActive && multiStoreData) ? multiStoreData.timeframe : legacyTf;

    const isFocused = isMultiChartActive ? focusedTarget === instanceId : true;

    const { chartType, indicators, indicatorParams, indicatorColors } = useChartStore();
    const { backgroundColor, candleUpColor, candleDownColor } = useSettingsStore();

    const setWsStatus = useMarketStore(s => s.setWsStatus);
    const updatePrice = useMarketStore(s => s.updatePrice);
    const alerts = useAlertStore(s => s.alerts);
    const paperTrades = usePaperStore(s => s.trades);
    const paperPosition = usePaperStore(s => s.position);

    const chartContainerRef = useRef(null);
    const paneContainersRef = useRef({});

    // ── LW-chart instances & series ──────────────────────────────────────────
    const chartRefs = useRef({ main: null, panes: {} });
    const seriesRefs = useRef({});
    const wsRef = useRef(null);

    // ── Kline data store (source of truth for re-renders) ────────────────────
    const klinesRef = useRef([]);          // all fetched OHLCV bars, sorted
    const loadingMoreRef = useRef(false);        // Phase 3 guard
    const noMoreHistoryRef = useRef(false);        // stop polling when API returns 0
    const alertPriceLines = useRef(new Map());    // alertId → priceLine object

    // ── UI state ─────────────────────────────────────────────────────────────
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);   // subtle "Loading older…" badge
    const [barCount, setBarCount] = useState(0);
    const [error, setError] = useState(false);
    const [crosshairData, setCrosshairData] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);

    const { isActive: replayActive, isChoosingStartNode, currentIndex: replayCurrentIndex } = useReplayStore();

    const [drawingTool, setDrawingTool] = useState('cursor');
    const [measureData, setMeasureData] = useState(null); // { startPrice, endPrice, startX, startY, endX, endY }

    // ── Keyboard chart scroll hook ───────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (!chartRefs.current.main) return;
            chartRefs.current.main.timeScale().scrollToPosition(
                (chartRefs.current.main.timeScale().scrollPosition() || 0) + e.detail.dir * 3,
                false
            );
        };
        window.addEventListener('nexus:chart-scroll', handler);
        return () => window.removeEventListener('nexus:chart-scroll', handler);
    }, []);

    // ── Indicator configs derived from store ─────────────────────────────────
    const activeConfigs = useMemo(() => {
        const typeMap = {
            ema_21: 'EMA', ema_50: 'EMA', ema_100: 'EMA', ema_200: 'EMA',
            sma_20: 'SMA', sma_50: 'SMA', sma_200: 'SMA', vwma_20: 'VWMA',
            rsi: 'RSI', macd: 'MACD', stoch: 'STOCH', stochrsi: 'STOCHRSI',
            cci: 'CCI', williams_r: 'WILLIAMS_R', bb: 'BB', atr_channel: 'ATR_CHANNEL',
            supertrend: 'SUPERTREND', ichimoku: 'ICHIMOKU', vwap: 'VWAP',
            adx: 'ADX', obv: 'OBV', volume_ma: 'VOLUME_MA',
        };
        return Object.entries(indicators)
            .filter(([, on]) => on)
            .map(([key]) => ({ id: key, type: typeMap[key], params: indicatorParams[key] || {} }));
    }, [indicators, indicatorParams]);

    const paneGroups = useMemo(() => ({
        pane_momentum: ['rsi', 'stoch', 'stochrsi', 'cci', 'williams_r'],
        pane_trend: ['macd', 'adx', 'obv'],
        pane_volume: ['volume_ma']
    }), []);

    const activePanes = useMemo(() => {
        return Object.keys(paneGroups).filter(group =>
            paneGroups[group].some(key => indicators[key])
        );
    }, [indicators, paneGroups]);

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers: push OHLCV data into every series from a klines array
    // ─────────────────────────────────────────────────────────────────────────
    const applyKlinesToSeries = useCallback((klines, mainSeries, volumeSeries) => {
        if (!klines.length) return;

        // ── Chart type transform ──
        let plotKlines = klines;
        if (chartType === 'heikin_ashi') {
            plotKlines = klines.map((c, i, arr) => {
                const prev = i === 0 ? null : arr[i - 1];
                const haClose = (c.open + c.high + c.low + c.close) / 4;
                const haOpen = prev ? (prev._haOpen + prev._haClose) / 2 : (c.open + c.close) / 2;
                return {
                    time: c.time,
                    open: haOpen, close: haClose,
                    high: Math.max(c.high, haOpen, haClose),
                    low: Math.min(c.low, haOpen, haClose),
                    _haOpen: haOpen, _haClose: haClose,
                    volume: c.volume,
                };
            });
        }

        if (chartType === 'line' || chartType === 'area') {
            mainSeries.setData(plotKlines.map(k => ({ time: k.time, value: k.close })));
        } else {
            mainSeries.setData(plotKlines);
        }

        volumeSeries.setData(klines.map(k => ({
            time: k.time,
            value: k.volume,
            color: k.close >= k.open ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)',
        })));
    }, [chartType]);

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers: recompute + push indicator data from klines
    // ─────────────────────────────────────────────────────────────────────────
    const applyIndicators = useCallback((klines) => {
        if (!klines.length || !activeConfigs.length) return;
        const results = computeAllIndicators(klines, activeConfigs);

        for (const [key, res] of Object.entries(results)) {
            const sr = seriesRefs.current[key];
            if (!sr) continue;

            const tv = (arr, colorFn) =>
                arr.map((v, i) => {
                    const point = { time: klines[i].time, value: v };
                    if (colorFn) point.color = colorFn(v);
                    return point;
                }).filter(d => d.value !== null && !isNaN(d.value));

            try {
                if (res.value !== undefined) {
                    if (sr.setData) sr.setData(tv(res.value));
                } else if (res.macd_line) {
                    sr.macd.setData(tv(res.macd_line));
                    sr.signal.setData(tv(res.signal_line));
                    sr.hist.setData(tv(res.histogram, v => v >= 0 ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)'));
                } else if (res.k && res.d) {
                    sr.k.setData(tv(res.k));
                    sr.d.setData(tv(res.d));
                } else if (res.upper && res.lower) {
                    sr.upper.setData(tv(res.upper));
                    sr.lower.setData(tv(res.lower));
                    if (res.basis && sr.mid) sr.mid.setData(tv(res.basis));
                } else if (res.tenkan) {
                    sr.tenkan.setData(tv(res.tenkan));
                    sr.kijun.setData(tv(res.kijun));
                    if (sr.senkouA) sr.senkouA.setData(tv(res.senkouA));
                    if (sr.senkouB) sr.senkouB.setData(tv(res.senkouB));
                } else if (res.adx) {
                    sr.adx.setData(tv(res.adx));
                    sr.plusDI.setData(tv(res.plusDI));
                    sr.minusDI.setData(tv(res.minusDI));
                } else if (res.volume_ma && sr.setData) {
                    sr.setData(tv(res.volume_ma));
                }
            } catch (e) {
                // Series might have been removed during symbol switch
            }
        }
    }, [activeConfigs]);

    useEffect(() => {
        const handleChartScroll = (e) => {
            const chart = chartRefs.current?.main;
            if (chart && e.detail?.delta) {
                chart.timeScale().scrollToPosition(e.detail.delta, false);
            }
        };
        window.addEventListener('nexus:chart-scroll', handleChartScroll);
        return () => window.removeEventListener('nexus:chart-scroll', handleChartScroll);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // REPLAY & PRICE SCALE CLICKS
    // ─────────────────────────────────────────────────────────────────────────
    const handleContainerClick = useCallback((e) => {
        if (!chartRefs.current?.main) return;
        const rect = chartContainerRef.current.getBoundingClientRect();

        // Ensure click bounds are actually inside the chart plotting area or scales
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 1. Replay start selection
        if (isChoosingStartNode) {
            const time = chartRefs.current.main.timeScale().coordinateToTime(x);
            if (!time) return;
            const idx = klinesRef.current.findIndex(k => k.time >= time);
            const startIdx = idx === -1 ? klinesRef.current.length - 1 : idx;
            useReplayStore.getState().startReplay(klinesRef.current, startIdx);
            return;
        }

        // 2. Price scale click-to-alert (check right 60px)
        if (x > rect.width - 64 && y > 0 && y < rect.height - 24) { // 24px is roughly time scale height
            const price = seriesRefs.current.main?.coordinateToPrice(y);
            if (price !== null && price !== undefined) {
                window.dispatchEvent(new CustomEvent('nexus:open-alert-creator', { detail: { price } }));
            }
        }
    }, [isChoosingStartNode]);

    // Handle Playback Stepping
    useEffect(() => {
        if (!replayActive || !seriesRefs.current?.main) return;

        const store = useReplayStore.getState();
        const visibleKlines = store.klines.slice(0, store.currentIndex + 1);
        if (visibleKlines.length === 0) return;

        // Force full setData redraw up to the masked future edge
        applyKlinesToSeries(visibleKlines, seriesRefs.current.main, seriesRefs.current.volume);
        applyIndicators(visibleKlines);

        // Auto-scroll to keep the playhead in view
        chartRefs.current.main.timeScale().scrollToPosition(0, true);

    }, [replayActive, replayCurrentIndex]);

    // Cleanup Replay on unmount or symbol switch
    useEffect(() => {
        return () => useReplayStore.getState().stopReplay();
    }, [activeSymbol, timeframe]);


    // ─────────────────────────────────────────────────────────────────────────
    // Main chart effect — runs on symbol / timeframe / indicator changes
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!chartContainerRef.current) return;

        setLoading(true);
        setError(false);
        setLoadingMore(false);
        klinesRef.current = [];
        loadingMoreRef.current = false;
        noMoreHistoryRef.current = false;

        // ── Build chart instances ──────────────────────────────────────────
        const chartOpts = {
            layout: {
                background: { type: 'Solid', color: backgroundColor },
                textColor: '#787b86',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.04)' },
                horzLines: { color: 'rgba(255,255,255,0.04)' },
            },
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: { borderColor: '#2a2e39' },
            timeScale: { borderColor: '#2a2e39', timeVisible: true, secondsVisible: false },
        };

        chartRefs.current.panes = {};
        const mainChart = createChart(chartContainerRef.current, chartOpts);
        chartRefs.current.main = mainChart;

        // ── Main series ───────────────────────────────────────────────────
        let mainSeries;
        switch (chartType) {
            case 'line':
                mainSeries = mainChart.addLineSeries({ color: '#2962ff', lineWidth: 1 });
                break;
            case 'area':
                mainSeries = mainChart.addAreaSeries({ lineColor: '#2962ff', topColor: 'rgba(41,98,255,0.28)', bottomColor: 'rgba(41,98,255,0)' });
                break;
            case 'bar':
                mainSeries = mainChart.addBarSeries({ upColor: candleUpColor, downColor: candleDownColor });
                break;
            default: // candlestick + heikin_ashi
                mainSeries = mainChart.addCandlestickSeries({
                    upColor: candleUpColor, downColor: candleDownColor, borderVisible: false,
                    wickUpColor: candleUpColor, wickDownColor: candleDownColor,
                });
        }

        const volumeSeries = mainChart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
        mainChart.priceScale('').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

        seriesRefs.current = { main: mainSeries, volume: volumeSeries };

        // ── Overlay indicators ────────────────────────────────────────────
        const getLwLineStyle = (uiStyle) => {
            if (uiStyle === 1) return 2; // Dashed
            if (uiStyle === 2) return 1; // Dotted
            return 0; // Solid
        };
        const indParams = useChartStore.getState().indicatorParams;

        const overlayKeys = ['ema_21', 'ema_50', 'ema_100', 'ema_200', 'sma_20', 'sma_50', 'sma_200', 'vwma_20', 'bb', 'atr_channel', 'supertrend', 'ichimoku', 'vwap'];
        overlayKeys.forEach(key => {
            if (!indicators[key]) return;
            const ls = getLwLineStyle(indParams[key]?.lineStyle || 0);

            if (key === 'bb') {
                seriesRefs.current[key] = {
                    upper: mainChart.addLineSeries({ color: indicatorColors.bb_upper, lineWidth: 1, lineStyle: ls === 0 ? 2 : ls }),
                    mid: mainChart.addLineSeries({ color: indicatorColors.bb_mid, lineWidth: 1, lineStyle: ls }),
                    lower: mainChart.addLineSeries({ color: indicatorColors.bb_lower, lineWidth: 1, lineStyle: ls === 0 ? 2 : ls }),
                };
            } else if (key === 'atr_channel') {
                seriesRefs.current[key] = {
                    upper: mainChart.addLineSeries({ color: 'rgba(255,255,255,0.3)', lineWidth: 1, lineStyle: ls === 0 ? 2 : ls }),
                    lower: mainChart.addLineSeries({ color: 'rgba(255,255,255,0.3)', lineWidth: 1, lineStyle: ls === 0 ? 2 : ls }),
                };
            } else if (key === 'supertrend') {
                seriesRefs.current[key] = mainChart.addLineSeries({ color: indicatorColors.supertrend_bull, lineWidth: 2, lineStyle: ls });
            } else if (key === 'ichimoku') {
                seriesRefs.current[key] = {
                    tenkan: mainChart.addLineSeries({ color: indicatorColors.ichimoku_tenkan, lineWidth: 1, lineStyle: ls }),
                    kijun: mainChart.addLineSeries({ color: indicatorColors.ichimoku_kijun, lineWidth: 1, lineStyle: ls }),
                    senkouA: mainChart.addLineSeries({ color: 'rgba(38,166,154,0.5)', lineWidth: 1, lineStyle: ls }),
                    senkouB: mainChart.addLineSeries({ color: 'rgba(239,83,80,0.5)', lineWidth: 1, lineStyle: ls }),
                };
            } else {
                const c = indicatorColors[key] || indicatorColors[`${key}_line`] || '#2962ff';
                seriesRefs.current[key] = mainChart.addLineSeries({ color: c, lineWidth: 1, lineStyle: ls });
            }
        });

        // ── Dynamic Oscillator Panes ─────────────────────────────────
        activePanes.forEach(group => {
            const container = paneContainersRef.current[group];
            if (!container) return; // Might not be mounted yet

            const chart = createChart(container, { ...chartOpts, height: 120 });
            chartRefs.current.panes[group] = chart;

            paneGroups[group].forEach(key => {
                if (!indicators[key]) return;
                const ls = getLwLineStyle(indParams[key]?.lineStyle || 0);

                if (key.includes('stoch')) {
                    seriesRefs.current[key] = {
                        k: chart.addLineSeries({ color: indicatorColors[`${key}_k`] || '#2962ff', lineWidth: 1, lineStyle: ls }),
                        d: chart.addLineSeries({ color: indicatorColors[`${key}_d`] || '#ff9800', lineWidth: 1, lineStyle: ls === 0 ? 1 : ls }),
                    };
                } else if (key === 'macd') {
                    seriesRefs.current[key] = {
                        macd: chart.addLineSeries({ color: indicatorColors.macd_line || '#2962ff', lineWidth: 1, lineStyle: ls }),
                        signal: chart.addLineSeries({ color: indicatorColors.macd_signal || '#ef5350', lineWidth: 1, lineStyle: ls === 0 ? 1 : ls }),
                        hist: chart.addHistogramSeries({ priceScaleId: '' }),
                    };
                    chart.priceScale('').applyOptions({ scaleMargins: { top: 0, bottom: 0 } });
                } else if (key === 'adx') {
                    seriesRefs.current[key] = {
                        adx: chart.addLineSeries({ color: indicatorColors.adx_line || '#ce93d8', lineWidth: 2, lineStyle: ls }),
                        plusDI: chart.addLineSeries({ color: indicatorColors.adx_plusDI || '#26a69a', lineWidth: 1 }),
                        minusDI: chart.addLineSeries({ color: indicatorColors.adx_minusDI || '#ef5350', lineWidth: 1 }),
                    };
                } else if (key === 'volume_ma') {
                    seriesRefs.current[key] = chart.addLineSeries({ color: indicatorColors.volume_ma_line || '#ff9800', lineWidth: 2, lineStyle: ls });
                } else {
                    const c = indicatorColors[`${key}_line`] || indicatorColors[key] || '#ce93d8';
                    seriesRefs.current[key] = chart.addLineSeries({ color: c, lineWidth: 1, lineStyle: ls });
                }
            });

            // Sync with main chart
            mainChart.timeScale().subscribeVisibleLogicalRangeChange(r => r && chart.timeScale().setVisibleLogicalRange(r));
            chart.timeScale().subscribeVisibleLogicalRangeChange(r => r && mainChart.timeScale().setVisibleLogicalRange(r));

            // Sync with siblings
            Object.keys(chartRefs.current.panes).forEach(otherGroup => {
                const otherChart = chartRefs.current.panes[otherGroup];
                if (group !== otherGroup && otherChart) {
                    chart.timeScale().subscribeVisibleLogicalRangeChange(r => r && otherChart.timeScale().setVisibleLogicalRange(r));
                    otherChart.timeScale().subscribeVisibleLogicalRangeChange(r => r && chart.timeScale().setVisibleLogicalRange(r));
                }
            });
        });

        // ── Crosshair handler ─────────────────────────────────────────────
        const onCrosshair = (param) => {
            if (!param.time || !param.seriesData.get(mainSeries)) {
                setCrosshairData(null); return;
            }
            const bar = param.seriesData.get(mainSeries);
            const kl = klinesRef.current;
            const prev = kl.findLast?.(k => k.time < param.time) ?? kl[kl.length - 2];

            const indVals = {};
            for (const key of Object.keys(indicators)) {
                const sr = seriesRefs.current[key];
                if (!indicators[key] || !sr) continue;
                if (sr.macd) indVals[key] = { macd: param.seriesData.get(sr.macd)?.value, signal: param.seriesData.get(sr.signal)?.value, hist: param.seriesData.get(sr.hist)?.value };
                else if (sr.k) indVals[key] = { k: param.seriesData.get(sr.k)?.value, d: param.seriesData.get(sr.d)?.value };
                else if (sr.upper) indVals[key] = { upper: param.seriesData.get(sr.upper)?.value, lower: param.seriesData.get(sr.lower)?.value };
                else if (sr.tenkan) indVals[key] = { tenkan: param.seriesData.get(sr.tenkan)?.value, kijun: param.seriesData.get(sr.kijun)?.value };
                else if (sr.adx) indVals[key] = { adx: param.seriesData.get(sr.adx)?.value };
                else indVals[key] = param.seriesData.get(sr)?.value;
            }

            setCrosshairData({
                time: param.time,
                open: bar.open, high: bar.high, low: bar.low, close: bar.close,
                prevClose: prev?.close ?? bar.open,
                indVals,
            });
        };

        mainChart.subscribeCrosshairMove(onCrosshair);
        Object.values(chartRefs.current.panes).forEach(chart => {
            chart.subscribeCrosshairMove(onCrosshair);
        });

        // ─────────────────────────────────────────────────────────────────
        // PHASE 3 — Infinite scroll: 1000-bar trigger, 1500-bar fetch
        //           View-range preservation prevents any visible jump
        // ─────────────────────────────────────────────────────────────────
        const onVisibleRangeChange = async (range) => {
            if (!range) return;
            if (range.from > SCROLL_TRIGGER_BARS) return;
            if (loadingMoreRef.current) return;
            if (noMoreHistoryRef.current) return;
            if (klinesRef.current.length === 0) return;

            loadingMoreRef.current = true;
            setLoadingMore(true);

            const oldest = klinesRef.current[0];
            const oldestMs = oldest.time * 1000;
            const prevLen = klinesRef.current.length;

            console.log(`[NEXUS] Phase 3: fetching 1500 bars before ${new Date(oldestMs).toISOString().slice(0, 10)}`);
            const older = await fetchOlderBars(activeSymbol, timeframe, oldestMs);

            if (older.length === 0) {
                noMoreHistoryRef.current = true;
                loadingMoreRef.current = false;
                setLoadingMore(false);
                return;
            }

            const merged = mergeAndSort(klinesRef.current, older);
            klinesRef.current = merged;
            setBarCount(merged.length);
            window.dispatchEvent(new CustomEvent('nexus:bar-count-update', { detail: merged.length }));

            // Save visible range → setData → restore shifted range (no jump)
            const ts = mainChart.timeScale();
            const savedRange = ts.getVisibleLogicalRange();

            applyKlinesToSeries(merged, mainSeries, volumeSeries);
            applyIndicators(merged);

            if (savedRange) {
                const addedBars = merged.length - prevLen;
                requestAnimationFrame(() => {
                    ts.setVisibleLogicalRange({
                        from: savedRange.from + addedBars,
                        to: savedRange.to + addedBars,
                    });
                });
            }

            loadingMoreRef.current = false;
            setLoadingMore(false);
            console.log(`[NEXUS] Phase 3 done: ${merged.length} total bars`);
        };

        mainChart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);

        // ─────────────────────────────────────────────────────────────────
        // Context menu on right-click
        // ─────────────────────────────────────────────────────────────────
        const onContextMenu = (e) => {
            e.preventDefault();
            const rect = chartContainerRef.current.getBoundingClientRect();
            const price = mainSeries.coordinateToPrice(e.clientY - rect.top);
            if (price !== null) setContextMenu({ x: e.clientX, y: e.clientY, price });
        };
        chartContainerRef.current.addEventListener('contextmenu', onContextMenu);

        // ── Resize observer ───────────────────────────────────────────────
        const resizeObs = new ResizeObserver(() => {
            const el = chartContainerRef.current;
            if (!el || !mainChart) return;
            mainChart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
            // The following lines for osc1Chart and osc2Chart are not defined in this scope.
            // They should be removed or properly defined if needed for dynamic panes.
            // if (osc1Chart && osc1ContainerRef.current) osc1Chart.applyOptions({ width: osc1ContainerRef.current.clientWidth });
            // if (osc2Chart && osc2ContainerRef.current) osc2Chart.applyOptions({ width: osc2ContainerRef.current.clientWidth });
            Object.values(chartRefs.current.panes).forEach(chart => {
                const container = chart.chartElement.parentElement; // Get the parent container of the pane chart
                if (container) {
                    chart.applyOptions({ width: container.clientWidth });
                }
            });
        });
        resizeObs.observe(chartContainerRef.current.parentElement);

        // ─────────────────────────────────────────────────────────────────
        // ██  PHASE 1 — Fetch latest 500 bars, render immediately
        // ─────────────────────────────────────────────────────────────────
        let isMounted = true;

        fetchLatestBars(activeSymbol, timeframe, PHASE1_BARS).then(async (phase1Bars) => {
            if (!isMounted) return;
            if (!phase1Bars.length) { setError(true); setLoading(false); return; }

            klinesRef.current = phase1Bars;
            setBarCount(phase1Bars.length);
            window.dispatchEvent(new CustomEvent('nexus:bar-count-update', { detail: phase1Bars.length }));

            applyKlinesToSeries(phase1Bars, mainSeries, volumeSeries);
            applyIndicators(phase1Bars);

            // Crosshair seed with last bar
            const last = phase1Bars[phase1Bars.length - 1];
            setCrosshairData({ time: last.time, open: last.open, high: last.high, low: last.low, close: last.close, prevClose: phase1Bars[phase1Bars.length - 2]?.close, indVals: {} });

            setLoading(false);   // ← chart is visible and interactive now
            console.log(`[NEXUS] Phase 1 done: ${phase1Bars.length} bars`);

            // ─────────────────────────────────────────────────────────────
            // ██  Connect WebSocket for live updates
            // ─────────────────────────────────────────────────────────────
            const ws = new WebSocket(`wss://fstream.binance.com/ws/${activeSymbol.toLowerCase()}@kline_${timeframe}`);
            wsRef.current = ws;
            ws.onopen = () => setWsStatus('connected');
            ws.onclose = () => setWsStatus('disconnected');
            ws.onmessage = (evt) => {
                if (!isMounted) return;

                // Block live updates if Replay is active
                if (useReplayStore.getState().isActive) return;

                const { e: type, k } = JSON.parse(evt.data);
                if (type !== 'kline') return;
                const tick = { time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v };

                // Update the last bar in our store
                const kl = klinesRef.current;
                if (kl.length && kl[kl.length - 1].time === tick.time) {
                    kl[kl.length - 1] = tick;
                } else if (tick.time > (kl[kl.length - 1]?.time ?? 0)) {
                    kl.push(tick);
                }

                if (chartType === 'line' || chartType === 'area') {
                    mainSeries.update({ time: tick.time, value: tick.close });
                } else {
                    mainSeries.update(tick);
                }
                volumeSeries.update({ time: tick.time, value: tick.volume, color: tick.close >= tick.open ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)' });
                updatePrice(activeSymbol, { price: tick.close });

                // Forward tick to Paper Trading engine via global event
                window.dispatchEvent(new CustomEvent('nexus:paper-tick', {
                    detail: tick
                }));
            };

            // ─────────────────────────────────────────────────────────────
            // ██  PHASE 2 — Deep parallel back-fill (~4,500 bars)
            //     Runs IN PARALLEL with WebSocket — live ticks flow immediately
            //     Uses view-range preservation — zero visible jump/flash
            // ─────────────────────────────────────────────────────────────
            if (!isMounted) return;
            const oldestMs = phase1Bars[0].time * 1000;
            console.log(`[NEXUS] Phase 2: deep back-fill from ${new Date(oldestMs).toISOString().slice(0, 10)}...`);

            fetchBackfill(activeSymbol, timeframe, oldestMs).then((backfillBars) => {
                if (!isMounted || backfillBars.length === 0) return;

                const prevLen = klinesRef.current.length;
                const merged = mergeAndSort(klinesRef.current, backfillBars);
                klinesRef.current = merged;
                setBarCount(merged.length);
                window.dispatchEvent(new CustomEvent('nexus:bar-count-update', { detail: merged.length }));

                // Save current scroll position → apply data → restore offset
                const ts = mainChart.timeScale();
                const savedRange = ts.getVisibleLogicalRange();

                applyKlinesToSeries(merged, mainSeries, volumeSeries);
                applyIndicators(merged);

                if (savedRange) {
                    const addedBars = merged.length - prevLen;
                    requestAnimationFrame(() => {
                        ts.setVisibleLogicalRange({
                            from: savedRange.from + addedBars,
                            to: savedRange.to + addedBars,
                        });
                    });
                }

                console.log(`[NEXUS] Phase 2 done: ${merged.length} total bars (added ${merged.length - prevLen} silently)`);
            });
        }).catch(err => {
            console.error('[NEXUS] Phase 1 failed:', err);
            if (isMounted) { setError(true); setLoading(false); }
        });

        // ── Full cleanup ──────────────────────────────────────────────────
        return () => {
            isMounted = false;
            try { chartContainerRef.current?.removeEventListener('contextmenu', onContextMenu); } catch { }
            resizeObs.disconnect();
            if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }

            if (chartRefs.current.main) {
                chartRefs.current.main.remove();
                chartRefs.current.main = null;
            }
            Object.values(chartRefs.current.panes).forEach(chart => {
                chart.remove();
            });
            chartRefs.current.panes = {};
            seriesRefs.current = {};
            // fetchData(); // Note: this effectively cancels/ignores pending in real code
        };
    }, [activeSymbol, timeframe, chartType, indicators, indicatorParams, indicatorColors, activePanes, paneGroups]);

    // ─────────────────────────────────────────────────────────────────────────
    // Dynamic Colors Effect 
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!chartRefs.current?.main) return;

        chartRefs.current.main.applyOptions({
            layout: { background: { type: 'Solid', color: backgroundColor } }
        });

        if (seriesRefs.current?.main) {
            if (chartType === 'line' || chartType === 'area') {
                // Keep default blue
            } else if (chartType === 'bar') {
                seriesRefs.current.main.applyOptions({ upColor: candleUpColor, downColor: candleDownColor });
            } else {
                seriesRefs.current.main.applyOptions({
                    upColor: candleUpColor, downColor: candleDownColor,
                    wickUpColor: candleUpColor, wickDownColor: candleDownColor,
                });
            }
        }
    }, [backgroundColor, candleUpColor, candleDownColor, chartType]);

    // ─────────────────────────────────────────────────────────────────────────
    // Alert price-lines sync
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const ms = seriesRefs.current.main;
        if (!ms) return;

        // Remove stale lines
        alertPriceLines.current.forEach((line, id) => {
            if (!alerts.find(a => a.id === id && a.armed)) {
                try { ms.removePriceLine(line); } catch { }
                alertPriceLines.current.delete(id);
            }
        });

        // Add new lines for armed price-target alerts on this symbol
        alerts
            .filter(a => a.symbol === activeSymbol && a.armed && !a.paused && a.params?.targetPrice)
            .forEach(a => {
                if (alertPriceLines.current.has(a.id)) return;
                try {
                    const line = ms.createPriceLine({
                        price: a.params.targetPrice,
                        color: '#f59f00',
                        lineWidth: 1,
                        lineStyle: 2, // Dashed
                        axisLabelVisible: true,
                        title: `🔔 ${a.name}`,
                    });
                    alertPriceLines.current.set(a.id, line);
                } catch { }
            });
    }, [alerts, activeSymbol]);

    // ─────────────────────────────────────────────────────────────────────────
    // Paper Trade markers (entry/exit arrows)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const ms = seriesRefs.current.main;
        if (!ms) return;

        const markers = [];

        paperTrades.forEach(t => {
            // Entry marker
            markers.push({
                time: Math.floor(t.entryTime / 1000),
                position: t.dir === 'long' ? 'belowBar' : 'aboveBar',
                color: t.dir === 'long' ? '#26a69a' : '#ef5350',
                shape: t.dir === 'long' ? 'arrowUp' : 'arrowDown',
                text: `${t.dir.toUpperCase()} @${t.entryPrice.toFixed(2)}`,
            });
            // Exit marker
            if (t.exitTime) {
                markers.push({
                    time: Math.floor(t.exitTime / 1000),
                    position: t.dir === 'long' ? 'aboveBar' : 'belowBar',
                    color: t.pnl >= 0 ? '#26a69a' : '#ef5350',
                    shape: 'circle',
                    text: `EXIT ${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}`,
                });
            }
        });

        // Current open position entry marker
        if (paperPosition) {
            markers.push({
                time: Math.floor(paperPosition.entryTime / 1000),
                position: paperPosition.dir === 'long' ? 'belowBar' : 'aboveBar',
                color: paperPosition.dir === 'long' ? '#26a69a' : '#ef5350',
                shape: paperPosition.dir === 'long' ? 'arrowUp' : 'arrowDown',
                text: `OPEN ${paperPosition.dir.toUpperCase()} @${paperPosition.entryPrice.toFixed(2)}`,
            });
        }

        // Sort by time (required by lightweight-charts)
        markers.sort((a, b) => a.time - b.time);

        try {
            ms.setMarkers(markers);
        } catch { }
    }, [paperTrades, paperPosition]);

    // ─────────────────────────────────────────────────────────────────────────
    // Close context menu on outside click / Escape
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const close = () => setContextMenu(null);
        window.addEventListener('click', close);
        window.addEventListener('nexus:close-all', close);
        return () => { window.removeEventListener('click', close); window.removeEventListener('nexus:close-all', close); };
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Drawing tools (Measure)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const handleToolChange = (e) => setDrawingTool(e.detail?.tool || 'cursor');
        const handleClear = () => setMeasureData(null);
        window.addEventListener('nexus:drawing-tool-change', handleToolChange);
        return () => {
            window.removeEventListener('nexus:drawing-tool-change', handleToolChange);
            window.removeEventListener('nexus:clear-drawings', handleClear);
        };
    }, []);

    // Clear drawings handler
    useEffect(() => {
        const handleClear = () => {
            window.dispatchEvent(new CustomEvent('nexus:clear-all-drawings'));
        };
        window.addEventListener('nexus:clear-drawings', handleClear);
        return () => window.removeEventListener('nexus:clear-drawings', handleClear);
    }, []);

    // Measure tool mouse handlers
    useEffect(() => {
        if (drawingTool !== 'measure') return;
        const container = chartContainerRef.current;
        if (!container) return;

        let isDrawing = false;
        let startY = 0, startX = 0, startPrice = 0;

        const onDown = (e) => {
            const ms = seriesRefs.current.main;
            if (!ms) return;
            isDrawing = true;
            const rect = container.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
            startPrice = ms.coordinateToPrice(startY) || 0;
        };

        const onMove = (e) => {
            if (!isDrawing) return;
            const ms = seriesRefs.current.main;
            if (!ms) return;
            const rect = container.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;
            const endPrice = ms.coordinateToPrice(endY) || 0;
            setMeasureData({ startPrice, endPrice, startX, startY, endX, endY });
        };

        const onUp = () => { isDrawing = false; };

        container.addEventListener('mousedown', onDown);
        container.addEventListener('mousemove', onMove);
        container.addEventListener('mouseup', onUp);
        return () => {
            container.removeEventListener('mousedown', onDown);
            container.removeEventListener('mousemove', onMove);
            container.removeEventListener('mouseup', onUp);
        };
    }, [drawingTool]);

    // ─────────────────────────────────────────────────────────────────────────
    // Legend (OHLC + indicators)
    // ─────────────────────────────────────────────────────────────────────────
    const legendContent = useMemo(() => {
        if (!crosshairData) return null;
        const { time, open, high, low, close, prevClose, indVals } = crosshairData;
        const diff = prevClose ? close - prevClose : 0;
        const pct = prevClose ? (diff / prevClose) * 100 : 0;
        const isUp = diff >= 0;
        const dt = new Date(time * 1000);
        const pad = n => String(n).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateStr = `${pad(dt.getUTCDate())} ${months[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
        const timeStr = ['1d', '1w', '1M'].includes(timeframe) ? '' : ` ${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`;

        return (
            <div className="flex flex-col text-xs leading-snug">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-100">{activeSymbol}</span>
                    <span className="text-gray-500">{timeframe}</span>
                    <span className="text-gray-500">{dateStr}{timeStr}</span>
                    <span className="text-gray-400 border-l border-gray-600 pl-2">O <span className="text-gray-100">{open?.toFixed?.(2)}</span></span>
                    <span className="text-gray-400">H <span className="text-gray-100">{high?.toFixed?.(2)}</span></span>
                    <span className="text-gray-400">L <span className="text-gray-100">{low?.toFixed?.(2)}</span></span>
                    <span className="text-gray-400">C <span className="text-gray-100">{close?.toFixed?.(2)}</span></span>
                    {prevClose && (
                        <span className={isUp ? 'text-tv-green' : 'text-tv-red'}>
                            {isUp ? '▲' : '▼'} {Math.abs(diff).toFixed(2)} ({isUp ? '+' : ''}{pct.toFixed(2)}%)
                        </span>
                    )}
                </div>
                {indVals && Object.keys(indVals).length > 0 && (
                    <div className="flex flex-wrap gap-x-3 mt-0.5">
                        {Object.entries(indVals).map(([key, val]) => {
                            if (!indicators[key] || val === undefined || val === null) return null;
                            const color = indicatorColors[`${key}_line`] || indicatorColors[key] || '#787b86';
                            const label = key.toUpperCase().replace('_', ' ');
                            if (typeof val === 'object') {
                                const parts = Object.entries(val)
                                    .filter(([, v]) => v != null)
                                    .map(([k, v]) => `${k.toUpperCase()}: ${Number(v).toFixed(2)}`)
                                    .join('  ');
                                return <span key={key} style={{ color }}>{label}: {parts}</span>;
                            }
                            return <span key={key} style={{ color }}>{label}: {Number(val).toFixed(2)}</span>;
                        })}
                    </div>
                )}
            </div>
        );
    }, [crosshairData, activeSymbol, timeframe, indicators, indicatorColors]);

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div
            className={`flex-1 flex flex-col relative bg-tv-bg text-tv-text h-full w-full select-none ${isChoosingStartNode ? 'cursor-crosshair' : ''} ${isMultiChartActive && isFocused ? 'ring-inset ring-2 ring-tv-blue z-10' : ''}`}
            onClick={(e) => {
                if (isMultiChartActive && !isFocused) setFocus(instanceId);
                handleContainerClick(e);
            }}
        >

            {/* Full-screen loading overlay — Phase 1 only */}
            {loading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-tv-bg/90">
                    <svg className="animate-spin h-6 w-6 text-tv-blue mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-tv-text">Loading {activeSymbol} · {timeframe}</span>
                    <span className="text-xs text-tv-muted mt-1">Fetching latest {PHASE1_BARS} bars…</span>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-tv-bg">
                    <button onClick={() => window.location.reload()} className="text-tv-red hover:text-red-400 text-sm">
                        ⚠ Failed to load data — click to retry
                    </button>
                </div>
            )}

            {/* Phase 2/3 subtle top badge (non-blocking) */}
            {!loading && loadingMore && (
                <div className="absolute top-2 right-3 z-20 flex items-center gap-1.5 bg-tv-panel/90 border border-tv-border rounded px-2 py-1 text-xs text-tv-muted">
                    <svg className="animate-spin h-3 w-3 text-tv-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading older bars…
                </div>
            )}

            {/* Phase 2 silent indicator (tiny dot while backfill runs) */}
            {!loading && !loadingMore && barCount > PHASE1_BARS && (
                <div className="absolute bottom-[2px] left-2 z-10 text-[10px] text-tv-dim pointer-events-none">
                    {barCount.toLocaleString()} bars loaded
                </div>
            )}

            {/* OHLC Legend */}
            {!loading && !error && crosshairData && (
                <div className="absolute top-2 left-3 z-10 pointer-events-none max-w-[90%]">
                    {legendContent}
                </div>
            )}

            {/* NEXUS watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.025] z-0">
                <span className="text-8xl font-black tracking-widest text-white">NEXUS</span>
            </div>

            {/* Replay Controller HUD */}
            <ReplayController />

            {/* Interactive Drawing Canvas Overlay */}
            {!loading && chartRefs.current?.main && seriesRefs.current?.main && !replayActive && (
                <DrawingCanvas
                    chart={chartRefs.current.main}
                    series={seriesRefs.current.main}
                    tool={drawingTool}
                    onToolDone={() => {
                        setDrawingTool('cursor');
                        window.dispatchEvent(new CustomEvent('nexus:drawing-tool-change', { detail: { tool: 'cursor' } }));
                    }}
                />
            )}

            {/* Paper Trading HUD & Manual Order Panel */}
            <PaperTradingHUD />
            <ManualOrderPanel />

            {/* Right-click context menu */}
            {contextMenu && (
                <div
                    className="fixed z-[200] bg-tv-panel border border-tv-border shadow-2xl rounded overflow-hidden text-[13px] min-w-[200px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        className="w-full text-left px-4 py-2.5 hover:bg-tv-hover text-gray-200 flex items-center gap-2"
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('nexus:open-alert-creator', { detail: { price: contextMenu.price } }));
                            setContextMenu(null);
                        }}
                    >
                        <span className="text-amber-400">🔔</span>
                        Add Alert at <strong>${contextMenu.price.toFixed(2)}</strong>
                    </button>
                    <div className="h-px bg-tv-border" />
                    <button
                        className="w-full text-left px-4 py-2.5 hover:bg-tv-hover text-gray-200 flex items-center gap-2"
                        onClick={() => { useChartStore.getState(); window.dispatchEvent(new CustomEvent('nexus:open-indicators')); setContextMenu(null); }}
                    >
                        📊 Add Indicator
                    </button>
                    <div className="h-px bg-tv-border" />
                    <button className="w-full text-left px-4 py-2.5 hover:bg-tv-hover text-gray-400" onClick={() => setContextMenu(null)}>
                        Cancel
                    </button>
                </div>
            )}

            {/* Measure Tool Overlay */}
            {measureData && (
                <div
                    className="absolute pointer-events-none z-30"
                    style={{
                        left: Math.min(measureData.startX, measureData.endX),
                        top: Math.min(measureData.startY, measureData.endY),
                        width: Math.abs(measureData.endX - measureData.startX),
                        height: Math.abs(measureData.endY - measureData.startY),
                    }}
                >
                    <div className="w-full h-full border border-dashed border-tv-blue/50 bg-tv-blue/5" />
                    <div className="absolute -top-6 right-0 bg-tv-panel border border-tv-border rounded px-2 py-0.5 text-[11px] text-gray-200 whitespace-nowrap shadow-lg">
                        {(() => {
                            const diff = measureData.endPrice - measureData.startPrice;
                            const pct = measureData.startPrice ? (diff / measureData.startPrice) * 100 : 0;
                            return `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
                        })()}
                    </div>
                </div>
            )}

            {/* Chart canvases */}
            <div className="flex-1 flex flex-col h-full w-full min-h-0">
                <div ref={chartContainerRef} className="flex-grow w-full min-h-[300px]" />

                {activePanes.map(group => (
                    <div key={group} className="border-t border-tv-border h-[120px] shrink-0">
                        <div ref={el => { if (el) paneContainersRef.current[group] = el; }} className="h-full w-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}
