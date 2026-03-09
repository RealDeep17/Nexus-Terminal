// ─────────────────────────────────────────────────────────────────────────────
// MultiTimeframeLoader — Loads multiple TFs for MTF strategy conditions
// ─────────────────────────────────────────────────────────────────────────────

import HistoricalDataLoader from './HistoricalDataLoader.js';

export default class MultiTimeframeLoader {
    constructor(onProgress = null) {
        this.onProgress = onProgress;
        this.loaders = [];
    }

    async load(symbol, timeframes, startDate, endDate, exchange = 'binance_futures') {
        const result = {};
        const total = timeframes.length;
        for (let i = 0; i < total; i++) {
            const tf = timeframes[i];
            if (this.onProgress) {
                this.onProgress({
                    phase: 'mtf_loading',
                    timeframe: tf,
                    current: i + 1,
                    total,
                    pct: ((i + 1) / total) * 100,
                });
            }
            const loader = new HistoricalDataLoader();
            this.loaders.push(loader);
            result[tf] = await loader.load(symbol, tf, startDate, endDate, exchange);
        }
        return result;
    }

    abortAll() {
        for (const loader of this.loaders) {
            loader.abort();
        }
        this.loaders = [];
    }
}
