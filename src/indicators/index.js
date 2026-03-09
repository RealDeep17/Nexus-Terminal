// ─────────────────────────────────────────────────────────────────────────────
// Shared Indicator Computation Engine
// Pure functions operating on OHLCV arrays. Used by both backtest engine
// and live chart display. All functions return arrays aligned with input.
// ─────────────────────────────────────────────────────────────────────────────

export function sma(source, period) {
    const result = new Array(source.length).fill(null);
    if (period > source.length) return result;
    let sum = 0;
    for (let i = 0; i < period; i++) sum += source[i];
    result[period - 1] = sum / period;
    for (let i = period; i < source.length; i++) {
        sum += source[i] - source[i - period];
        result[i] = sum / period;
    }
    return result;
}

export function ema(source, period) {
    const result = new Array(source.length).fill(null);
    if (period > source.length) return result;
    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += source[i];
    result[period - 1] = sum / period;
    for (let i = period; i < source.length; i++) {
        result[i] = source[i] * k + result[i - 1] * (1 - k);
    }
    return result;
}

export function wma(source, period) {
    const result = new Array(source.length).fill(null);
    if (period > source.length) return result;
    const denom = (period * (period + 1)) / 2;
    for (let i = period - 1; i < source.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += source[i - period + 1 + j] * (j + 1);
        }
        result[i] = sum / denom;
    }
    return result;
}

export function rma(source, period) {
    const result = new Array(source.length).fill(null);
    if (period > source.length) return result;
    let sum = 0;
    for (let i = 0; i < period; i++) sum += source[i];
    result[period - 1] = sum / period;
    for (let i = period; i < source.length; i++) {
        result[i] = (result[i - 1] * (period - 1) + source[i]) / period;
    }
    return result;
}

export function trueRange(highs, lows, closes) {
    const len = highs.length;
    const result = new Array(len).fill(null);
    result[0] = highs[0] - lows[0];
    for (let i = 1; i < len; i++) {
        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i - 1]);
        const lc = Math.abs(lows[i] - closes[i - 1]);
        result[i] = Math.max(hl, hc, lc);
    }
    return result;
}

export function atr(highs, lows, closes, period = 14) {
    const tr = trueRange(highs, lows, closes);
    return rma(tr, period);
}

export function rsi(source, period = 14) {
    const len = source.length;
    const result = new Array(len).fill(null);
    if (period >= len) return result;
    const gains = new Array(len).fill(0);
    const losses = new Array(len).fill(0);
    for (let i = 1; i < len; i++) {
        const change = source[i] - source[i - 1];
        gains[i] = change > 0 ? change : 0;
        losses[i] = change < 0 ? -change : 0;
    }
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= period; i++) {
        avgGain += gains[i];
        avgLoss += losses[i];
    }
    avgGain /= period;
    avgLoss /= period;
    if (avgLoss === 0) {
        result[period] = 100;
    } else {
        result[period] = 100 - 100 / (1 + avgGain / avgLoss);
    }
    for (let i = period + 1; i < len; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        if (avgLoss === 0) {
            result[i] = 100;
        } else {
            result[i] = 100 - 100 / (1 + avgGain / avgLoss);
        }
    }
    return result;
}

export function macd(source, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEma = ema(source, fastPeriod);
    const slowEma = ema(source, slowPeriod);
    const len = source.length;
    const macdLine = new Array(len).fill(null);
    for (let i = 0; i < len; i++) {
        if (fastEma[i] !== null && slowEma[i] !== null) {
            macdLine[i] = fastEma[i] - slowEma[i];
        }
    }
    const macdValid = [];
    let startIdx = 0;
    for (let i = 0; i < len; i++) {
        if (macdLine[i] !== null) {
            macdValid.push(macdLine[i]);
            if (macdValid.length === 1) startIdx = i;
        }
    }
    const signalArr = ema(macdValid, signalPeriod);
    const signalLine = new Array(len).fill(null);
    const histogram = new Array(len).fill(null);
    for (let i = 0; i < macdValid.length; i++) {
        if (signalArr[i] !== null) {
            signalLine[startIdx + i] = signalArr[i];
            histogram[startIdx + i] = macdLine[startIdx + i] - signalArr[i];
        }
    }
    return { macd_line: macdLine, signal_line: signalLine, histogram };
}

export function bollingerBands(source, period = 20, mult = 2) {
    const len = source.length;
    const basis = sma(source, period);
    const upper = new Array(len).fill(null);
    const lower = new Array(len).fill(null);
    const width = new Array(len).fill(null);
    const pctB = new Array(len).fill(null);
    for (let i = period - 1; i < len; i++) {
        let sumSq = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const diff = source[j] - basis[i];
            sumSq += diff * diff;
        }
        const stddev = Math.sqrt(sumSq / period);
        upper[i] = basis[i] + mult * stddev;
        lower[i] = basis[i] - mult * stddev;
        width[i] = upper[i] !== lower[i] ? (upper[i] - lower[i]) / basis[i] : 0;
        pctB[i] = upper[i] !== lower[i] ? (source[i] - lower[i]) / (upper[i] - lower[i]) : 0.5;
    }
    return { basis, upper, lower, width, pctB };
}

export function stochastic(highs, lows, closes, kPeriod = 14, kSmooth = 3, dSmooth = 3) {
    const len = closes.length;
    const rawK = new Array(len).fill(null);
    for (let i = kPeriod - 1; i < len; i++) {
        let hh = -Infinity;
        let ll = Infinity;
        for (let j = i - kPeriod + 1; j <= i; j++) {
            hh = Math.max(hh, highs[j]);
            ll = Math.min(ll, lows[j]);
        }
        rawK[i] = hh !== ll ? ((closes[i] - ll) / (hh - ll)) * 100 : 50;
    }
    const validK = rawK.filter((v) => v !== null);
    const startK = rawK.indexOf(validK[0]);
    const smoothedK = sma(validK, kSmooth);
    const k = new Array(len).fill(null);
    for (let i = 0; i < smoothedK.length; i++) {
        if (smoothedK[i] !== null) k[startK + i] = smoothedK[i];
    }
    const validKSmooth = k.filter((v) => v !== null);
    const startD = k.indexOf(validKSmooth[0]);
    const smoothedD = sma(validKSmooth, dSmooth);
    const d = new Array(len).fill(null);
    for (let i = 0; i < smoothedD.length; i++) {
        if (smoothedD[i] !== null) d[startD + i] = smoothedD[i];
    }
    return { k, d };
}

export function stochasticRsi(source, rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3) {
    const rsiVals = rsi(source, rsiPeriod);
    const len = source.length;
    const rawK = new Array(len).fill(null);
    for (let i = 0; i < len; i++) {
        if (rsiVals[i] === null) continue;
        let startJ = i - stochPeriod + 1;
        if (startJ < 0) continue;
        let hh = -Infinity;
        let ll = Infinity;
        let valid = true;
        for (let j = startJ; j <= i; j++) {
            if (rsiVals[j] === null) { valid = false; break; }
            hh = Math.max(hh, rsiVals[j]);
            ll = Math.min(ll, rsiVals[j]);
        }
        if (!valid) continue;
        rawK[i] = hh !== ll ? ((rsiVals[i] - ll) / (hh - ll)) * 100 : 50;
    }
    const validRaw = [];
    let rawStart = -1;
    for (let i = 0; i < len; i++) {
        if (rawK[i] !== null) {
            validRaw.push(rawK[i]);
            if (rawStart === -1) rawStart = i;
        }
    }
    const kSmoothed = sma(validRaw, kSmooth);
    const k = new Array(len).fill(null);
    for (let i = 0; i < kSmoothed.length; i++) {
        if (kSmoothed[i] !== null) k[rawStart + i] = kSmoothed[i];
    }
    const validK = [];
    let kStart = -1;
    for (let i = 0; i < len; i++) {
        if (k[i] !== null) {
            validK.push(k[i]);
            if (kStart === -1) kStart = i;
        }
    }
    const dSmoothed = sma(validK, dSmooth);
    const d = new Array(len).fill(null);
    for (let i = 0; i < dSmoothed.length; i++) {
        if (dSmoothed[i] !== null) d[kStart + i] = dSmoothed[i];
    }
    return { k, d };
}

export function adx(highs, lows, closes, period = 14) {
    const len = highs.length;
    const plusDM = new Array(len).fill(0);
    const minusDM = new Array(len).fill(0);
    for (let i = 1; i < len; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
        minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    }
    const atrVals = atr(highs, lows, closes, period);
    const smoothPlusDM = rma(plusDM, period);
    const smoothMinusDM = rma(minusDM, period);
    const plusDI = new Array(len).fill(null);
    const minusDI = new Array(len).fill(null);
    const dx = new Array(len).fill(null);
    for (let i = 0; i < len; i++) {
        if (smoothPlusDM[i] !== null && atrVals[i] !== null && atrVals[i] !== 0) {
            plusDI[i] = (smoothPlusDM[i] / atrVals[i]) * 100;
            minusDI[i] = (smoothMinusDM[i] / atrVals[i]) * 100;
            const diSum = plusDI[i] + minusDI[i];
            dx[i] = diSum !== 0 ? (Math.abs(plusDI[i] - minusDI[i]) / diSum) * 100 : 0;
        }
    }
    const dxValid = [];
    let dxStart = -1;
    for (let i = 0; i < len; i++) {
        if (dx[i] !== null) {
            dxValid.push(dx[i]);
            if (dxStart === -1) dxStart = i;
        }
    }
    const adxSmoothed = rma(dxValid, period);
    const adxLine = new Array(len).fill(null);
    for (let i = 0; i < adxSmoothed.length; i++) {
        if (adxSmoothed[i] !== null) adxLine[dxStart + i] = adxSmoothed[i];
    }
    return { adx: adxLine, plusDI, minusDI };
}

export function supertrend(highs, lows, closes, period = 10, multiplier = 3) {
    const len = closes.length;
    const atrVals = atr(highs, lows, closes, period);
    const st = new Array(len).fill(null);
    const direction = new Array(len).fill(1);
    const upperBand = new Array(len).fill(null);
    const lowerBand = new Array(len).fill(null);
    for (let i = 0; i < len; i++) {
        if (atrVals[i] === null) continue;
        const hl2 = (highs[i] + lows[i]) / 2;
        upperBand[i] = hl2 + multiplier * atrVals[i];
        lowerBand[i] = hl2 - multiplier * atrVals[i];
    }
    for (let i = 1; i < len; i++) {
        if (upperBand[i] === null) continue;
        if (lowerBand[i - 1] !== null) {
            lowerBand[i] = closes[i - 1] > lowerBand[i - 1]
                ? Math.max(lowerBand[i], lowerBand[i - 1])
                : lowerBand[i];
        }
        if (upperBand[i - 1] !== null) {
            upperBand[i] = closes[i - 1] < upperBand[i - 1]
                ? Math.min(upperBand[i], upperBand[i - 1])
                : upperBand[i];
        }
        if (st[i - 1] === upperBand[i - 1]) {
            direction[i] = closes[i] > upperBand[i] ? -1 : 1;
        } else {
            direction[i] = closes[i] < lowerBand[i] ? 1 : -1;
        }
        st[i] = direction[i] === 1 ? upperBand[i] : lowerBand[i];
    }
    if (upperBand[0] !== null) st[0] = upperBand[0];
    return { supertrend: st, direction };
}

export function ichimoku(highs, lows, closes, tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52, displacement = 26) {
    const len = closes.length;
    function donchianMid(h, l, p, idx) {
        if (idx < p - 1) return null;
        let hh = -Infinity;
        let ll = Infinity;
        for (let i = idx - p + 1; i <= idx; i++) {
            hh = Math.max(hh, h[i]);
            ll = Math.min(ll, l[i]);
        }
        return (hh + ll) / 2;
    }
    const tenkan = new Array(len).fill(null);
    const kijun = new Array(len).fill(null);
    const senkouA = new Array(len + displacement).fill(null);
    const senkouB = new Array(len + displacement).fill(null);
    const chikou = new Array(len).fill(null);
    for (let i = 0; i < len; i++) {
        tenkan[i] = donchianMid(highs, lows, tenkanPeriod, i);
        kijun[i] = donchianMid(highs, lows, kijunPeriod, i);
        if (tenkan[i] !== null && kijun[i] !== null) {
            senkouA[i + displacement] = (tenkan[i] + kijun[i]) / 2;
        }
        const sb = donchianMid(highs, lows, senkouBPeriod, i);
        if (sb !== null) senkouB[i + displacement] = sb;
        if (i - displacement >= 0) chikou[i - displacement] = closes[i];
    }
    return {
        tenkan: tenkan.slice(0, len),
        kijun: kijun.slice(0, len),
        senkouA: senkouA.slice(0, len),
        senkouB: senkouB.slice(0, len),
        chikou,
    };
}

export function vwap(highs, lows, closes, volumes) {
    const len = closes.length;
    const result = new Array(len).fill(null);
    let cumVol = 0;
    let cumTP = 0;
    for (let i = 0; i < len; i++) {
        const tp = (highs[i] + lows[i] + closes[i]) / 3;
        cumVol += volumes[i];
        cumTP += tp * volumes[i];
        result[i] = cumVol !== 0 ? cumTP / cumVol : tp;
    }
    return result;
}

export function obv(closes, volumes) {
    const len = closes.length;
    const result = new Array(len).fill(0);
    result[0] = volumes[0];
    for (let i = 1; i < len; i++) {
        if (closes[i] > closes[i - 1]) result[i] = result[i - 1] + volumes[i];
        else if (closes[i] < closes[i - 1]) result[i] = result[i - 1] - volumes[i];
        else result[i] = result[i - 1];
    }
    return result;
}

export function volumeMA(volumes, period = 20) {
    return sma(volumes, period);
}

export function vwma(closes, volumes, period) {
    const result = new Array(closes.length).fill(null);
    for (let i = period - 1; i < closes.length; i++) {
        let sumPV = 0, sumV = 0;
        for (let j = i - period + 1; j <= i; j++) { sumPV += closes[j] * volumes[j]; sumV += volumes[j]; }
        result[i] = sumV > 0 ? sumPV / sumV : null;
    }
    return result;
}

export function cci(highs, lows, closes, period = 20) {
    const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
    const tpSma = sma(tp, period);
    const result = new Array(tp.length).fill(null);
    for (let i = period - 1; i < tp.length; i++) {
        let md = 0;
        for (let j = i - period + 1; j <= i; j++) md += Math.abs(tp[j] - tpSma[i]);
        md /= period;
        result[i] = md !== 0 ? (tp[i] - tpSma[i]) / (0.015 * md) : 0;
    }
    return result;
}

export function williamsR(highs, lows, closes, period = 14) {
    const result = new Array(closes.length).fill(null);
    for (let i = period - 1; i < closes.length; i++) {
        let hh = -Infinity, ll = Infinity;
        for (let j = i - period + 1; j <= i; j++) { hh = Math.max(hh, highs[j]); ll = Math.min(ll, lows[j]); }
        result[i] = hh !== ll ? -100 * (hh - closes[i]) / (hh - ll) : -50;
    }
    return result;
}

export function atrChannel(highs, lows, closes, period = 14, multiplier = 1.5) {
    const atrVals = atr(highs, lows, closes, period);
    return {
        upper: closes.map((c, i) => atrVals[i] !== null ? c + atrVals[i] * multiplier : null),
        lower: closes.map((c, i) => atrVals[i] !== null ? c - atrVals[i] * multiplier : null),
    };
}

export function computeAllIndicators(bars, indicatorConfigs) {
    const opens = bars.map((b) => b.open);
    const highs = bars.map((b) => b.high);
    const lows = bars.map((b) => b.low);
    const closes = bars.map((b) => b.close);
    const volumes = bars.map((b) => b.volume);
    const results = {};
    for (const config of indicatorConfigs) {
        const { id, type, params } = config;
        switch (type) {
            case 'SMA':
                results[id] = { value: sma(closes, params.period) };
                break;
            case 'EMA':
                results[id] = { value: ema(closes, params.period) };
                break;
            case 'WMA':
                results[id] = { value: wma(closes, params.period) };
                break;
            case 'RSI':
                results[id] = { value: rsi(closes, params.period || 14) };
                break;
            case 'MACD': {
                const m = macd(closes, params.fastPeriod || 12, params.slowPeriod || 26, params.signalPeriod || 9);
                results[id] = { macd_line: m.macd_line, signal_line: m.signal_line, histogram: m.histogram };
                break;
            }
            case 'BB': {
                const bb = bollingerBands(closes, params.period || 20, params.mult || 2);
                results[id] = { basis: bb.basis, upper: bb.upper, lower: bb.lower, width: bb.width, pctB: bb.pctB };
                break;
            }
            case 'ATR':
                results[id] = { value: atr(highs, lows, closes, params.period || 14) };
                break;
            case 'STOCH': {
                const s = stochastic(highs, lows, closes, params.kPeriod || 14, params.kSmooth || 3, params.dSmooth || 3);
                results[id] = { k: s.k, d: s.d };
                break;
            }
            case 'STOCHRSI': {
                const sr = stochasticRsi(closes, params.rsiPeriod || 14, params.stochPeriod || 14, params.kSmooth || 3, params.dSmooth || 3);
                results[id] = { k: sr.k, d: sr.d };
                break;
            }
            case 'ADX': {
                const a = adx(highs, lows, closes, params.period || 14);
                results[id] = { adx: a.adx, plusDI: a.plusDI, minusDI: a.minusDI };
                break;
            }
            case 'SUPERTREND': {
                const sup = supertrend(highs, lows, closes, params.period || 10, params.multiplier || 3);
                results[id] = { value: sup.supertrend, direction: sup.direction };
                break;
            }
            case 'ICHIMOKU': {
                const ich = ichimoku(highs, lows, closes, params.tenkanPeriod || 9, params.kijunPeriod || 26, params.senkouBPeriod || 52, params.displacement || 26);
                results[id] = { tenkan: ich.tenkan, kijun: ich.kijun, senkouA: ich.senkouA, senkouB: ich.senkouB, chikou: ich.chikou };
                break;
            }
            case 'VWAP':
                results[id] = { value: vwap(highs, lows, closes, volumes) };
                break;
            case 'OBV':
                results[id] = { value: obv(closes, volumes) };
                break;
            case 'VOLUME_MA':
                results[id] = { value: volumeMA(volumes, params.period || 20) };
                break;
            case 'VWMA':
                results[id] = { value: vwma(closes, volumes, params.period || 20) };
                break;
            case 'CCI':
                results[id] = { value: cci(highs, lows, closes, params.period || 20) };
                break;
            case 'WILLIAMS_R':
                results[id] = { value: williamsR(highs, lows, closes, params.period || 14) };
                break;
            case 'ATR_CHANNEL':
                results[id] = atrChannel(highs, lows, closes, params.period || 14, params.multiplier || 1.5);
                break;
            default:
                break;
        }
    }
    return results;
}

export function getIndicatorValue(indicators, indicatorId, barIndex) {
    const dotIdx = indicatorId.indexOf('.');
    let id, outputKey;
    if (dotIdx !== -1) {
        id = indicatorId.substring(0, dotIdx);
        outputKey = indicatorId.substring(dotIdx + 1);
    } else {
        id = indicatorId;
        outputKey = 'value';
    }
    const indicator = indicators[id];
    if (!indicator) return null;
    const series = indicator[outputKey];
    if (!series) return null;
    if (barIndex < 0 || barIndex >= series.length) return null;
    return series[barIndex];
}

export function getPriceSource(bar, source) {
    switch (source) {
        case 'open': return bar.open;
        case 'high': return bar.high;
        case 'low': return bar.low;
        case 'close': return bar.close;
        case 'hl2': return (bar.high + bar.low) / 2;
        case 'hlc3': return (bar.high + bar.low + bar.close) / 3;
        case 'ohlc4': return (bar.open + bar.high + bar.low + bar.close) / 4;
        default: return bar.close;
    }
}

export function extractIndicatorConfigs(strategy) {
    const configs = [];
    const seen = new Set();
    function addConfig(id, type, params) {
        if (seen.has(id)) return;
        seen.add(id);
        configs.push({ id, type, params });
    }
    function scanConditions(condGroup) {
        if (!condGroup || !condGroup.items) return;
        for (const item of condGroup.items) {
            if (item.logic) {
                scanConditions(item);
                continue;
            }
            switch (item.type) {
                case 'INDICATOR_CROSS_PRICE':
                case 'INDICATOR_VALUE_THRESHOLD':
                case 'INDICATOR_SLOPE':
                    parseIndicatorRef(item.params.indicatorId);
                    break;
                case 'INDICATOR_CROSS_INDICATOR':
                    parseIndicatorRef(item.params.indicatorA);
                    parseIndicatorRef(item.params.indicatorB);
                    break;
                case 'VOLUME_CONDITION':
                    addConfig('volume_ma_20', 'VOLUME_MA', { period: item.params.maPeriod || 20 });
                    break;
                case 'MULTI_TIMEFRAME':
                    if (item.params.condition) scanConditions({ logic: 'AND', items: [item.params.condition] });
                    break;
                case 'PERSIST':
                case 'LOOKBACK':
                case 'NOT':
                    if (item.params.condition) scanConditions({ logic: 'AND', items: [item.params.condition] });
                    break;
                default:
                    break;
            }
        }
    }
    function parseIndicatorRef(ref) {
        if (!ref) return;
        const dotIdx = ref.indexOf('.');
        const baseId = dotIdx !== -1 ? ref.substring(0, dotIdx) : ref;
        const match = baseId.match(/^([a-z_]+?)_?(\d+)$/i);
        if (match) {
            const typeName = match[1].toUpperCase();
            const period = parseInt(match[2], 10);
            const typeMap = {
                'EMA': 'EMA', 'SMA': 'SMA', 'WMA': 'WMA', 'RSI': 'RSI',
                'ATR': 'ATR', 'ADX': 'ADX', 'BB': 'BB', 'MACD': 'MACD',
                'STOCH': 'STOCH', 'STOCHRSI': 'STOCHRSI', 'SUPERTREND': 'SUPERTREND',
                'VWAP': 'VWAP', 'OBV': 'OBV', 'VOLUME_MA': 'VOLUME_MA',
            };
            const type = typeMap[typeName] || typeName;
            addConfig(baseId, type, { period });
        } else {
            const knownTypes = {
                'macd': { type: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
                'bb': { type: 'BB', params: { period: 20, mult: 2 } },
                'vwap': { type: 'VWAP', params: {} },
                'obv': { type: 'OBV', params: {} },
                'ichimoku': { type: 'ICHIMOKU', params: {} },
                'supertrend': { type: 'SUPERTREND', params: { period: 10, multiplier: 3 } },
            };
            const known = knownTypes[baseId.toLowerCase()];
            if (known) addConfig(baseId, known.type, known.params);
        }
    }
    if (strategy.entryRule) scanConditions(strategy.entryRule.conditions);
    if (strategy.exitRule) scanConditions(strategy.exitRule.conditions);
    if (strategy.filters) {
        if (strategy.filters.trendFilter && strategy.filters.trendFilter.enabled) {
            const tf = strategy.filters.trendFilter;
            const id = `${tf.indicator.toLowerCase()}_${tf.period}`;
            addConfig(id, tf.indicator.toUpperCase(), { period: tf.period });
        }
        if (strategy.filters.volatilityFilter && strategy.filters.volatilityFilter.enabled) {
            addConfig('atr_14', 'ATR', { period: 14 });
        }
    }
    return configs;
}
