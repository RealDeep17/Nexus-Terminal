// ─────────────────────────────────────────────────────────────────────────────
// StrategyPresets
// ─────────────────────────────────────────────────────────────────────────────


export const StrategyPresets = [
    {
        id: 'preset-ema-cross',
        name: 'EMA Golden/Death Cross',
        description: 'Classic trend-following strategy using 50 and 200 period EMA crosses.',
        version: '1.0',
        universe: { symbol: 'BTCUSDT', timeframe: '1h', exchange: 'binance_futures' },
        backtestConfig: {
            initialCapital: 10000,
            commissionType: 'percentage',
            commissionValue: 0.04,
            slippageType: 'percent',
            slippageValue: 0.05,
        },
        entryRule: {
            direction: 'both',
            conditions: {
                logic: 'OR',
                items: [
                    {
                        type: 'indicator_cross_indicator',
                        params: { indicatorA: 'ema_50', indicatorB: 'ema_200', direction: 'cross_above' },
                        note: 'Golden Cross (Go Long)'
                    },
                    {
                        type: 'indicator_cross_indicator',
                        params: { indicatorA: 'ema_50', indicatorB: 'ema_200', direction: 'cross_below' },
                        note: 'Death Cross (Go Short)'
                    }
                ]
            },
            sizing: { type: 'percent_equity', value: 100 },
            order: { type: 'market' }
        },
        exitRule: {
            stopLoss: { enabled: true, type: 'atr', value: 2, trailingEnabled: true, trailingType: 'percent', trailingValue: 1.5 },
            takeProfit: { enabled: true, type: 'risk_reward', value: 3 },
            timeExit: { enabled: false, barsInTrade: 0 }
        },
        filters: {}
    },
    {
        id: 'preset-rsi-mean-rev',
        name: 'RSI Mean Reversion',
        description: 'Buys oversold RSI (<30) when price is above 200 EMA. Sells on overbought RSI (>70).',
        version: '1.0',
        universe: { symbol: 'ETHUSDT', timeframe: '15m', exchange: 'binance_futures' },
        backtestConfig: {
            initialCapital: 10000,
            commissionType: 'percentage',
            commissionValue: 0.04,
            slippageType: 'none',
            slippageValue: 0,
        },
        entryRule: {
            direction: 'long',
            conditions: {
                logic: 'AND',
                items: [
                    {
                        type: 'indicator_value_threshold',
                        params: { indicatorId: 'rsi_14', operator: '<', value: 30 }
                    }
                ]
            },
            sizing: { type: 'fixed_usdt', value: 1000 },
            order: { type: 'market' }
        },
        exitRule: {
            conditions: {
                logic: 'AND',
                items: [
                    {
                        type: 'indicator_value_threshold',
                        params: { indicatorId: 'rsi_14', operator: '>', value: 70 }
                    }
                ]
            },
            stopLoss: { enabled: true, type: 'percent', value: 2 },
            takeProfit: { enabled: false }
        },
        filters: {
            trendFilter: { enabled: true, indicator: 'ema', period: 200, onlyLongAbove: true, onlyShortBelow: false }
        }
    },
    {
        id: 'preset-macd-bb-squeeze',
        name: 'MACD Bollinger Squeeze Breakout',
        description: 'Enters trades when Bollinger Bands are squeezing and MACD crosses the zero line.',
        version: '1.0',
        universe: { symbol: 'SOLUSDT', timeframe: '5m', exchange: 'binance_futures' },
        backtestConfig: {
            initialCapital: 10000,
            commissionType: 'percentage',
            commissionValue: 0.04,
        },
        entryRule: {
            direction: 'both',
            conditions: {
                logic: 'AND',
                items: [
                    {
                        type: 'indicator_value_threshold',
                        params: { indicatorPath: 'bb_20.bandwidth', operator: '<', value: 0.05 } // simplified generic check
                    },
                    {
                        logic: 'OR',
                        items: [
                            // Need custom condition params matching evaluator for MACD Zero cross
                        ]
                    }
                ]
            },
            sizing: { type: 'risk_percent', value: 1 },
            order: { type: 'market' }
        },
        exitRule: {
            stopLoss: { enabled: true, type: 'atr', value: 1.5 },
            takeProfit: { enabled: true, type: 'risk_reward', value: 2 },
        },
        filters: {}
    }
];
