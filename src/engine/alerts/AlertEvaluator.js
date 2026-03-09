// ─────────────────────────────────────────────────────────────────────────────
// AlertEvaluator — Pure logical evaluation of alert conditions
// ─────────────────────────────────────────────────────────────────────────────

import { getIndicatorValue } from '../../indicators/index.js';

export class AlertEvaluator {
    static evaluate(alert, data) {
        if (!data || !data.price) return false;

        try {
            switch (alert.type) {
                case 'PRICE_TARGET':
                    return this._evaluatePriceTarget(alert, data);
                case 'PRICE_CROSSES_EMA':
                    return this._evaluatePriceCrossesEma(alert, data);
                case 'EMA_CROSSES_EMA':
                    return this._evaluateEmaCross(alert, data);
                case 'RSI_LEVEL':
                    return this._evaluateRsiLevel(alert, data);
                case 'MACD_CROSS':
                    return this._evaluateMacdCross(alert, data);
                case 'BB_TOUCH':
                    return this._evaluateBbTouch(alert, data);
                case 'PRICE_MOVE_PCT':
                    return this._evaluatePriceMovePct(alert, data);
                case 'VOLUME_SPIKE':
                    return this._evaluateVolumeSpike(alert, data);
                case 'INDICATOR_VALUE':
                    return this._evaluateGenericIndicator(alert, data);
                default:
                    return false;
            }
        } catch (err) {
            console.error(`Error evaluating alert ${alert.id}:`, err);
            return false;
        }
    }

    static _evaluatePriceTarget(alert, data) {
        const { operator, targetPrice } = alert.params;
        if (operator === '>=' || operator === 'above') return data.price >= targetPrice;
        if (operator === '<=' || operator === 'below') return data.price <= targetPrice;
        return false;
    }

    static _evaluatePriceCrossesEma(alert, data) {
        const { emaKey, direction } = alert.params;
        const indResult = data.indicators && data.indicators[emaKey];
        if (!indResult?.value) return false;

        const arr = indResult.value;
        if (arr.length < 2) return false;

        const prevEma = arr[arr.length - 2];
        const currEma = arr[arr.length - 1];
        if (prevEma === null || currEma === null) return false;

        if (direction === 'cross_above') {
            return data.prevPrice < prevEma && data.price >= currEma;
        }
        if (direction === 'cross_below') {
            return data.prevPrice > prevEma && data.price <= currEma;
        }
        return false;
    }

    static _evaluateEmaCross(alert, data) {
        const { emaA, emaB, direction } = alert.params;
        const indA = data.indicators && data.indicators[emaA];
        const indB = data.indicators && data.indicators[emaB];
        if (!indA?.value || !indB?.value) return false;

        const arrA = indA.value;
        const arrB = indB.value;
        if (arrA.length < 2 || arrB.length < 2) return false;

        const prevA = arrA[arrA.length - 2];
        const currA = arrA[arrA.length - 1];
        const prevB = arrB[arrB.length - 2];
        const currB = arrB[arrB.length - 1];

        if (prevA === null || currA === null || prevB === null || currB === null) return false;

        if (direction === 'cross_above') {
            return prevA < prevB && currA >= currB;
        }
        if (direction === 'cross_below') {
            return prevA > prevB && currA <= currB;
        }
        return false;
    }

    static _evaluateRsiLevel(alert, data) {
        const { rsiKey = 'rsi_14', condition, level } = alert.params;
        const indResult = data.indicators && data.indicators[rsiKey];
        if (!indResult?.value) return false;

        const arr = indResult.value;
        if (arr.length < 2) return false;

        const prevRsi = arr[arr.length - 2];
        const currRsi = arr[arr.length - 1];

        if (prevRsi === null || currRsi === null) return false;

        if (condition === 'enters_overbought') {
            const topLevel = level || 70;
            return prevRsi < topLevel && currRsi >= topLevel;
        }
        if (condition === 'exits_oversold') {
            const botLevel = level || 30;
            return prevRsi < botLevel && currRsi >= botLevel;
        }
        if (condition === 'cross_above') {
            return prevRsi < level && currRsi >= level;
        }
        if (condition === 'cross_below') {
            return prevRsi > level && currRsi <= level;
        }
        return false;
    }

    static _evaluateMacdCross(alert, data) {
        const { macdKey = 'macd', condition } = alert.params;
        const indResult = data.indicators && data.indicators[macdKey];
        if (!indResult) return false;

        const hist = indResult.histogram;
        const macdLine = indResult.macd_line;
        if (!hist || hist.length < 2 || !macdLine || macdLine.length < 2) return false;

        const prevHist = hist[hist.length - 2];
        const currHist = hist[hist.length - 1];
        const prevLine = macdLine[macdLine.length - 2];
        const currLine = macdLine[macdLine.length - 1];

        if (prevHist === null || currHist === null || prevLine === null || currLine === null) return false;

        if (condition === 'macd_crosses_signal_bullish') {
            return prevHist < 0 && currHist >= 0;
        }
        if (condition === 'macd_crosses_signal_bearish') {
            return prevHist > 0 && currHist <= 0;
        }
        if (condition === 'macd_crosses_zero_bullish') {
            return prevLine < 0 && currLine >= 0;
        }
        if (condition === 'macd_crosses_zero_bearish') {
            return prevLine > 0 && currLine <= 0;
        }
        return false;
    }

    static _evaluateBbTouch(alert, data) {
        const { bbKey = 'bb_20', condition } = alert.params;
        const indResult = data.indicators && data.indicators[bbKey];
        if (!indResult) return false;

        const { upper, lower, basis } = indResult;
        if (!upper || upper.length < 1 || !lower || Object.keys(lower).length < 1) return false;

        const currKline = data.currentKline;
        const currUpper = upper[upper.length - 1];
        const currLower = lower[lower.length - 1];
        const currMid = basis[basis.length - 1];

        if (currUpper === null || currLower === null) return false;

        if (condition === 'touches_upper') {
            return currKline.high >= currUpper;
        }
        if (condition === 'touches_lower') {
            return currKline.low <= currLower;
        }
        if (condition === 'squeeze') {
            const { bandwidthThreshold, lookback = 50 } = alert.params;
            const len = upper.length;
            if (len < lookback) return false;

            let sumBw = 0;
            let validCount = 0;
            for (let i = len - lookback; i < len; i++) {
                if (upper[i] !== null && lower[i] !== null && basis[i]) {
                    sumBw += (upper[i] - lower[i]) / basis[i];
                    validCount++;
                }
            }
            if (validCount === 0 || !currMid) return false;

            const avgBw = sumBw / validCount;
            const currentBw = (currUpper - currLower) / currMid;
            return currentBw < avgBw * bandwidthThreshold;
        }
        return false;
    }

    static _evaluatePriceMovePct(alert, data) {
        const { minutes, threshold, direction } = alert.params;
        const klines = data.klines;

        if (!klines || klines.length < 2) return false;

        let intervalMs = klines[1].time - klines[0].time;
        // Normalization: if interval is strangely small (like 60), it means timestamps are in seconds
        if (intervalMs > 0 && intervalMs < 10000) {
            intervalMs *= 1000;
        }
        // Fallback to 1 minute to prevent Infinity / NaN errors
        if (isNaN(intervalMs) || intervalMs <= 0) {
            intervalMs = 60000;
        }

        const barsAgo = Math.ceil((minutes * 60000) / intervalMs);

        if (klines.length <= barsAgo) return false;

        const oldPrice = klines[klines.length - 1 - barsAgo].close;
        const movePct = ((data.price - oldPrice) / oldPrice) * 100;

        if (direction === 'up' || direction === 'above') return movePct >= threshold;
        if (direction === 'down' || direction === 'below') return movePct <= -threshold;
        if (direction === 'any') return Math.abs(movePct) >= threshold;
        return false;
    }

    static _evaluateVolumeSpike(alert, data) {
        const { period = 20, multiplier = 2.5 } = alert.params;
        const klines = data.klines;
        if (!klines || klines.length < period + 1) return false;

        const recentVol = data.currentKline.volume;
        const historicalVols = klines.slice(-(period + 1), -1).map(k => k.volume);
        const avgVol = historicalVols.reduce((a, b) => a + b, 0) / historicalVols.length;

        return recentVol >= avgVol * multiplier;
    }

    static _evaluateGenericIndicator(alert, data) {
        const { indicatorPath, operator, threshold } = alert.params;
        const [indKey, outKey] = indicatorPath.split('.');

        const indResult = data.indicators && data.indicators[indKey];
        if (!indResult) return false;

        const arr = indResult[outKey || 'value'];
        if (!arr || arr.length === 0) return false;

        const val = arr[arr.length - 1];
        if (val === null) return false;

        switch (operator) {
            case '>': return val > threshold;
            case '>=': return val >= threshold;
            case '<': return val < threshold;
            case '<=': return val <= threshold;
            case '==': return val === threshold;
            default: return false;
        }
    }
}
