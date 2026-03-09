import { ConditionRegistry } from '../conditions/ConditionRegistry.js';
import ConditionEvaluator from './ConditionEvaluator.js';
import { computeAllIndicators } from '../../indicators/index.js';
import useJournalStore from '../../store/useJournalStore.js';

class PaperTrader {
    constructor(strategy, symbol, initialCapital = 10000) {
        this.strategy = strategy;
        this.symbol = symbol;
        this.equity = initialCapital;
        this.initialCapital = initialCapital;
        this.position = null; // { dir, entryPrice, qty, entryTime }
        this.trades = [];
        this.equityCurve = [{ time: Date.now() / 1000, equity: initialCapital }];
        this.bars = []; // rolling window of last 500 bars
        this.indicators = {}; // computed from bars
        this._listeners = [];
        this.isRunning = false;
    }

    start() { this.isRunning = true; }
    stop() { this.isRunning = false; }

    onUpdate(fn) { this._listeners.push(fn); }

    _emit() {
        this._listeners.forEach(fn => fn({
            equity: this.equity,
            position: this.position,
            trades: [...this.trades],
            equityCurve: [...this.equityCurve],
            pnl: this.equity - this.initialCapital,
            pnlPct: ((this.equity - this.initialCapital) / this.initialCapital) * 100
        }));
    }

    executeManualOrder(dir, qty, price) {
        if (!this.isRunning || this.position) return false;
        const commission = price * qty * 0.0004;
        this.equity -= commission;
        this.position = {
            dir,
            entryPrice: price,
            qty,
            entryTime: Date.now(),
            currentPnl: -commission,
            currentPnlPct: -(commission / (price * qty)) * 100
        };
        this.equityCurve.push({ time: Date.now() / 1000, equity: this.equity });
        this._emit();
        return true;
    }

    closePosition(price, reason = 'manual_close') {
        if (!this.isRunning || !this.position) return false;
        const pnl = this.position.dir === 'long'
            ? (price - this.position.entryPrice) * this.position.qty
            : (this.position.entryPrice - price) * this.position.qty;
        const commission = price * this.position.qty * 0.0004;
        this.equity += pnl - commission;

        const logItem = {
            id: Date.now(),
            symbol: this.symbol,
            direction: this.position.dir,
            entryPrice: this.position.entryPrice,
            exitPrice: price,
            qty: this.position.qty,
            pnl: pnl - commission,
            pnlPct: ((pnl - commission) / (this.position.entryPrice * this.position.qty)) * 100,
            entryTime: this.position.entryTime,
            exitTime: Date.now(),
            exitReason: reason,
        };

        this.trades.push(logItem);
        useJournalStore.getState().addEntry(logItem);
        this.position = null;
        this.equityCurve.push({ time: Date.now() / 1000, equity: this.equity });
        this._emit();
        return true;
    }

    // Call this on every WS kline update
    tick(kline) {
        if (!this.isRunning) return;

        // Update rolling bars window
        const lastBar = this.bars[this.bars.length - 1];
        if (lastBar && lastBar.time === kline.time) {
            this.bars[this.bars.length - 1] = kline; // update current bar
        } else {
            this.bars.push(kline);
            if (this.bars.length > 500) this.bars.shift();
        }

        if (this.bars.length < 50) return; // need warmup

        // Recompute indicators from latest bars
        // Build configs array in the format computeAllIndicators expects: [{id, type, params}]
        const configs = Object.entries(defaultIndicatorConfigs).map(([id, params]) => ({
            id,
            type: indicatorTypeMap[id] || 'EMA',
            params
        }));

        this.indicators = computeAllIndicators(this.bars, configs);

        const bar = kline;
        const prevBar = this.bars[this.bars.length - 2] || bar;

        // Build context for condition evaluation
        const ctx = {
            bar, prevBar,
            bars: this.bars,
            indicators: this.indicators,
            getIndicator: (id) => {
                // return latest value for indicatorId, e.g. "rsi_14.value" or "macd.histogram"
                const parts = id.split('.');
                const key = parts[0];
                const field = parts[1] || 'value';
                const arr = this.indicators[key]?.[field];
                if (!arr) return null;
                const lastIdx = arr.length - 1;
                return arr[lastIdx] !== null ? arr[lastIdx] : null;
            },
            getPrevIndicator: (id) => {
                const parts = id.split('.');
                const key = parts[0];
                const field = parts[1] || 'value';
                const arr = this.indicators[key]?.[field];
                if (!arr || arr.length < 2) return null;
                const lastIdx = arr.length - 2;
                return arr[lastIdx] !== null ? arr[lastIdx] : null;
            },
            position: this.position,
            equity: this.equity,
        };

        // Check exits first
        if (this.position) {
            const sl = this.strategy.exitRule?.stopLoss;
            const tp = this.strategy.exitRule?.takeProfit;
            let shouldExit = false;
            let exitPrice = bar.close;
            let exitReason = 'signal';

            if (sl?.enabled) {
                const slPct = sl.value / 100;
                const slPrice = this.position.dir === 'long'
                    ? this.position.entryPrice * (1 - slPct)
                    : this.position.entryPrice * (1 + slPct);
                if ((this.position.dir === 'long' && bar.low <= slPrice) ||
                    (this.position.dir === 'short' && bar.high >= slPrice)) {
                    shouldExit = true; exitPrice = slPrice; exitReason = 'stop_loss';
                }
            }

            if (!shouldExit && tp?.enabled) {
                const tpPct = tp.value / 100;
                const tpPrice = this.position.dir === 'long'
                    ? this.position.entryPrice * (1 + tpPct)
                    : this.position.entryPrice * (1 - tpPct);
                if ((this.position.dir === 'long' && bar.high >= tpPrice) ||
                    (this.position.dir === 'short' && bar.low <= tpPrice)) {
                    shouldExit = true; exitPrice = tpPrice; exitReason = 'take_profit';
                }
            }

            if (!shouldExit && this.strategy.exitRule?.conditions) {
                // Evaluate exit condition
                const reg = new ConditionRegistry();
                const evalr = new ConditionEvaluator(reg);
                shouldExit = evalr.evaluate(this.strategy.exitRule.conditions, ctx);
                if (shouldExit) exitReason = 'signal';
            }

            if (shouldExit) {
                const pnl = this.position.dir === 'long'
                    ? (exitPrice - this.position.entryPrice) * this.position.qty
                    : (this.position.entryPrice - exitPrice) * this.position.qty;
                const commission = exitPrice * this.position.qty * 0.0004;
                this.equity += pnl - commission;

                const logItem = {
                    id: Date.now(),
                    symbol: this.symbol,
                    dir: this.position.dir,
                    entryPrice: this.position.entryPrice,
                    exitPrice,
                    qty: this.position.qty,
                    pnl: pnl - commission,
                    pnlPct: ((pnl - commission) / (this.position.entryPrice * this.position.qty)) * 100,
                    entryTime: this.position.entryTime,
                    exitTime: bar.time * 1000,
                    exitReason,
                };

                this.trades.push(logItem);
                useJournalStore.getState().addEntry(logItem);


                this.position = null;
                this.equityCurve.push({ time: bar.time, equity: this.equity });
                this._emit();
                return;
            }
        }

        // Check entries
        if (!this.position) {
            const reg = new ConditionRegistry();
            const evalr = new ConditionEvaluator(reg);
            const entrySignal = evalr.evaluate(this.strategy.entryRule?.conditions, ctx);

            if (entrySignal) {
                const sizing = this.strategy.entryRule?.sizing || { type: 'percent_equity', value: 10 };
                const capitalUsed = (sizing.value / 100) * this.equity;
                const qty = capitalUsed / bar.close;
                const commission = bar.close * qty * 0.0004;
                this.equity -= commission;

                this.position = {
                    dir: this.strategy.entryRule?.direction || 'long',
                    entryPrice: bar.close,
                    qty,
                    entryTime: bar.time * 1000,
                    currentPnl: 0,
                };

                this.equityCurve.push({ time: bar.time, equity: this.equity });
                this._emit();
            }

            // Compute current PnL if in position
            if (this.position) {
                const unrealizedPnl = this.position.dir === 'long'
                    ? (bar.close - this.position.entryPrice) * this.position.qty
                    : (this.position.entryPrice - bar.close) * this.position.qty;
                this.position.currentPnl = unrealizedPnl;
                const unrealizedPnlPct = (unrealizedPnl / (this.position.entryPrice * this.position.qty)) * 100;
                this.position.currentPnlPct = unrealizedPnlPct;
                this._emit();
            }
        } else {
            // Update live Pnl
            const unrealizedPnl = this.position.dir === 'long'
                ? (bar.close - this.position.entryPrice) * this.position.qty
                : (this.position.entryPrice - bar.close) * this.position.qty;
            this.position.currentPnl = unrealizedPnl;
            const unrealizedPnlPct = (unrealizedPnl / (this.position.entryPrice * this.position.qty)) * 100;
            this.position.currentPnlPct = unrealizedPnlPct;
            this._emit();
        }
    }
}

// Map from config id to type string for computeAllIndicators
const indicatorTypeMap = {
    sma_20: 'SMA', sma_50: 'SMA', sma_200: 'SMA',
    ema_21: 'EMA', ema_50: 'EMA', ema_100: 'EMA', ema_200: 'EMA',
    rsi_14: 'RSI',
    macd: 'MACD',
    bollinger: 'BB',
    atr: 'ATR',
    stoch: 'STOCH',
    adx: 'ADX',
    supertrend: 'SUPERTREND',
    ichimoku: 'ICHIMOKU',
    vwap: 'VWAP',
    obv: 'OBV',
    vwma_20: 'VWMA',
    cci_20: 'CCI',
    williams_r_14: 'WILLIAMS_R',
    volume_ma_20: 'VOLUME_MA'
};

// Hardcoded default fallback mapping so we don't have to parse all strategy files
const defaultIndicatorConfigs = {
    sma_20: { period: 20 },
    sma_50: { period: 50 },
    sma_200: { period: 200 },
    ema_21: { period: 21 },
    ema_50: { period: 50 },
    ema_100: { period: 100 },
    ema_200: { period: 200 },
    rsi_14: { period: 14 },
    macd: { fast: 12, slow: 26, signal: 9 },
    bollinger: { period: 20, stdDev: 2 },
    atr: { period: 14 },
    stoch: { k: 14, d: 3, smooth: 3 },
    adx: { period: 14 },
    supertrend: { factor: 3, period: 10 },
    ichimoku: { conversionPeriod: 9, basePeriod: 26, spanPeriod: 52, displacement: 26 },
    vwap: {},
    obv: {},
    vwma_20: { period: 20 },
    cci_20: { period: 20 },
    williams_r_14: { period: 14 },
    volume_ma_20: { period: 20 }
};

export default PaperTrader;
