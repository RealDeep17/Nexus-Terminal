// ─────────────────────────────────────────────────────────────────────────────
// BarIterator — Walks through historical bars providing context at each step
// ─────────────────────────────────────────────────────────────────────────────

import { computeAllIndicators, getIndicatorValue, getPriceSource } from '../../indicators/index.js';

export default class BarIterator {
    constructor(bars, indicatorConfigs, additionalTFData = {}) {
        this.bars = bars;
        this.indicatorConfigs = indicatorConfigs;
        this.indicators = computeAllIndicators(bars, indicatorConfigs);
        this.additionalTFData = additionalTFData;
        this.additionalTFIndicators = {};
        for (const [tf, tfBars] of Object.entries(additionalTFData)) {
            this.additionalTFIndicators[tf] = {
                bars: tfBars,
                indicators: computeAllIndicators(tfBars, indicatorConfigs),
            };
        }
        this.currentIndex = 0;
        this.warmupPeriod = this._calculateWarmup();
    }

    _calculateWarmup() {
        let maxWarmup = 0;
        for (const config of this.indicatorConfigs) {
            const p = config.params.period || 0;
            switch (config.type) {
                case 'MACD':
                    maxWarmup = Math.max(maxWarmup, (config.params.slowPeriod || 26) + (config.params.signalPeriod || 9));
                    break;
                case 'STOCH':
                case 'STOCHRSI':
                    maxWarmup = Math.max(maxWarmup, (config.params.rsiPeriod || 14) + (config.params.stochPeriod || 14) + (config.params.kSmooth || 3) + (config.params.dSmooth || 3));
                    break;
                case 'ICHIMOKU':
                    maxWarmup = Math.max(maxWarmup, (config.params.senkouBPeriod || 52) + (config.params.displacement || 26));
                    break;
                case 'ADX':
                    maxWarmup = Math.max(maxWarmup, p * 3);
                    break;
                case 'BB':
                    maxWarmup = Math.max(maxWarmup, p);
                    break;
                default:
                    maxWarmup = Math.max(maxWarmup, p + 1);
                    break;
            }
        }
        return Math.max(maxWarmup, 1);
    }

    get startIndex() {
        return Math.min(this.warmupPeriod, this.bars.length - 1);
    }

    get endIndex() {
        return this.bars.length - 1;
    }

    get totalBars() {
        return this.bars.length;
    }

    getContext(index, position = null, equity = 0) {
        this.currentIndex = index;
        const bar = this.bars[index];
        return {
            bar,
            barIndex: index,
            bars: this.bars,
            indicators: this.indicators,
            position,
            equity,
            getIndicator: (indicatorId) => getIndicatorValue(this.indicators, indicatorId, index),
            getPrevIndicator: (indicatorId, barsAgo = 1) => getIndicatorValue(this.indicators, indicatorId, index - barsAgo),
            getPrice: (source) => getPriceSource(bar, source || 'close'),
            getPrevBar: (barsAgo = 1) => index - barsAgo >= 0 ? this.bars[index - barsAgo] : null,
            getHTFContext: (timeframe) => this._getHTFContext(timeframe, bar.time),
        };
    }

    _getHTFContext(timeframe, currentTime) {
        const tfData = this.additionalTFIndicators[timeframe];
        if (!tfData) return null;
        const htfBars = tfData.bars;
        let htfIndex = -1;
        for (let i = htfBars.length - 1; i >= 0; i--) {
            if (htfBars[i].time <= currentTime) {
                htfIndex = i;
                break;
            }
        }
        if (htfIndex === -1) return null;
        return {
            bar: htfBars[htfIndex],
            barIndex: htfIndex,
            bars: htfBars,
            indicators: tfData.indicators,
            getIndicator: (indicatorId) => getIndicatorValue(tfData.indicators, indicatorId, htfIndex),
            getPrevIndicator: (indicatorId, barsAgo = 1) => getIndicatorValue(tfData.indicators, indicatorId, htfIndex - barsAgo),
            getPrice: (source) => getPriceSource(htfBars[htfIndex], source || 'close'),
            getPrevBar: (barsAgo = 1) => htfIndex - barsAgo >= 0 ? htfBars[htfIndex - barsAgo] : null,
        };
    }
}
