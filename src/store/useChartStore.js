import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useMultiChartStore from './useMultiChartStore.js';

const useChartStore = create(
    persist(
        (set) => ({
            activeSymbol: 'BTCUSDT',
            timeframe: '1h',
            chartType: 'candlestick',

            indicators: {
                ema_21: true,
                ema_50: true,
                ema_100: false,
                ema_200: true,
                sma_20: false,
                sma_50: false,
                sma_200: false,
                vwma_20: false,
                rsi: false,
                macd: false,
                stoch: false,
                stochrsi: false,
                cci: false,
                williams_r: false,
                bb: false,
                atr_channel: false,
                supertrend: false,
                ichimoku: false,
                vwap: false,
                adx: false,
                obv: false,
                volume_ma: false
            },

            indicatorParams: {
                ema_21: { period: 21 },
                ema_50: { period: 50 },
                ema_100: { period: 100 },
                ema_200: { period: 200 },
                sma_20: { period: 20 },
                sma_50: { period: 50 },
                sma_200: { period: 200 },
                vwma_20: { period: 20 },
                rsi: { period: 14, obLevel: 70, osLevel: 30 },
                macd: { fast: 12, slow: 26, signal: 9 },
                stoch: { kPeriod: 14, kSmooth: 3, dSmooth: 3 },
                stochrsi: { rsiPeriod: 14, stochPeriod: 14, kSmooth: 3, dSmooth: 3 },
                cci: { period: 20 },
                williams_r: { period: 14 },
                bb: { period: 20, stdDev: 2 },
                atr_channel: { period: 14, multiplier: 1.5 },
                supertrend: { period: 10, multiplier: 3 },
                ichimoku: { tenkan: 9, kijun: 26, senkouB: 52, displacement: 26 },
                vwap: { showBands: false },
                adx: { period: 14 },
                obv: {},
                volume_ma: { period: 20 }
            },

            indicatorColors: {
                ema_21: '#2962ff',
                ema_50: '#ff9800',
                ema_100: '#e91e63',
                ema_200: '#9c27b0',
                sma_20: '#00bcd4',
                sma_50: '#8bc34a',
                sma_200: '#ff5722',
                vwma_20: '#26c6da',
                rsi_line: '#ce93d8',
                stoch_k: '#2962ff',
                stoch_d: '#ff9800',
                stochrsi_k: '#2962ff',
                stochrsi_d: '#ff9800',
                macd_line: '#2962ff',
                macd_signal: '#ef5350',
                macd_hist_up: 'rgba(38,166,154,0.5)',
                macd_hist_dn: 'rgba(239,83,80,0.5)',
                bb_upper: 'rgba(41,98,255,0.4)',
                bb_mid: '#2962ff',
                bb_lower: 'rgba(41,98,255,0.4)',
                bb_fill: 'rgba(41,98,255,0.04)',
                supertrend_bull: '#26a69a',
                supertrend_bear: '#ef5350',
                ichimoku_tenkan: '#2962ff',
                ichimoku_kijun: '#ef5350',
                ichimoku_cloud_up: 'rgba(38,166,154,0.1)',
                ichimoku_cloud_dn: 'rgba(239,83,80,0.1)',
                vwap_line: '#ff9800',
                adx_line: '#ce93d8',
                adx_plusDI: '#26a69a',
                adx_minusDI: '#ef5350',
                obv_line: '#26a69a'
            },

            setSymbol: (symbol) => set((state) => {
                const multi = useMultiChartStore.getState();
                if (multi && multi.layoutId !== '1') {
                    multi.updateChart(multi.focusedTarget, { symbol });
                }
                return { activeSymbol: symbol };
            }),
            setTimeframe: (tf) => set((state) => {
                const multi = useMultiChartStore.getState();
                if (multi && multi.layoutId !== '1') {
                    multi.updateChart(multi.focusedTarget, { timeframe: tf });
                }
                return { timeframe: tf };
            }),
            setChartType: (type) => set({ chartType: type }),

            toggleIndicator: (indicatorKey) => set((state) => ({
                indicators: { ...state.indicators, [indicatorKey]: !state.indicators[indicatorKey] }
            })),

            setIndicatorParam: (indicatorKey, paramKey, value) => set((state) => ({
                indicatorParams: {
                    ...state.indicatorParams,
                    [indicatorKey]: { ...state.indicatorParams[indicatorKey], [paramKey]: value }
                }
            })),

            setIndicatorColor: (indicatorKey, color) => set((state) => ({
                indicatorColors: { ...state.indicatorColors, [indicatorKey]: color }
            }))
        }), {
        name: 'nexus-chart-store',
        partialize: (state) => ({
            indicators: state.indicators,
            indicatorParams: state.indicatorParams,
            indicatorColors: state.indicatorColors,
            activeSymbol: state.activeSymbol,
            timeframe: state.timeframe,
            chartType: state.chartType
        })
    }));

export default useChartStore;
