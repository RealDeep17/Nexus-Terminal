// ─────────────────────────────────────────────────────────────────────────────
// StrategySchema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The definitive schema for a NEXUS Terminal Strategy Object.
 * Used for validation, serialization, and UI form generation.
 */
export const StrategySchema = {
    id: 'string', // uuid
    name: 'string',
    description: 'string',
    version: 'string',

    universe: {
        symbol: 'string',
        timeframe: 'string',
        exchange: 'string', // 'binance_futures', 'binance_spot'
    },

    backtestConfig: {
        initialCapital: 'number',
        commissionType: 'string', // 'percentage', 'fixed'
        commissionValue: 'number',
        slippageType: 'string',   // 'none', 'fixed_ticks', 'percent', 'atr_fraction'
        slippageValue: 'number',
    },

    entryRule: {
        direction: 'string', // 'long', 'short', 'both'
        conditions: {
            logic: 'string', // 'AND', 'OR'
            items: 'array',  // Array of condition objects
        },
        sizing: {
            type: 'string', // 'percent_equity', 'fixed_usdt', 'risk_percent', 'kelly'
            value: 'number',
        },
        order: {
            type: 'string', // 'market', 'limit', 'stop'
            limitOffset: 'number',
            stopOffset: 'number',
        }
    },

    exitRule: {
        conditions: {
            logic: 'string',
            items: 'array',
        },
        stopLoss: {
            enabled: 'boolean',
            type: 'string', // 'percent', 'atr', 'fixed'
            value: 'number',
            trailingEnabled: 'boolean',
            trailingType: 'string',
            trailingValue: 'number',
        },
        takeProfit: {
            enabled: 'boolean',
            type: 'string', // 'percent', 'atr', 'risk_reward', 'fixed'
            value: 'number',
            partialExits: 'array', // [{ percent: 50, atValue: 2 }]
        },
        timeExit: {
            enabled: 'boolean',
            barsInTrade: 'number',
        }
    },

    filters: {
        sessionFilter: {
            enabled: 'boolean',
            allowedHours: 'array', // [0,1,2...,23]
        },
        trendFilter: {
            enabled: 'boolean',
            indicator: 'string', // 'ema', 'sma'
            period: 'number',
            onlyLongAbove: 'boolean',
            onlyShortBelow: 'boolean',
        },
        volatilityFilter: {
            enabled: 'boolean',
            minATR: 'number',
            maxATR: 'number',
        },
        maxConsecutiveLosses: 'number',
        maxDailyDrawdown: 'number',
        maxTotalDrawdown: 'number',
    }
};
