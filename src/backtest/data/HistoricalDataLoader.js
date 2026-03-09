// ─────────────────────────────────────────────────────────────────────────────
// HistoricalDataLoader — Fetches + caches full kline history from Binance
// ─────────────────────────────────────────────────────────────────────────────

import DataCache from './DataCache.js';
import DataNormalizer from './DataNormalizer.js';

const BINANCE_FUTURES_BASE = 'https://fapi.binance.com';
const BINANCE_SPOT_BASE = 'https://api.binance.com';
const MAX_KLINES_PER_REQUEST = 1500;

export default class HistoricalDataLoader {
    constructor(onProgress = null) {
        this.onProgress = onProgress;
        this.abortController = null;
    }

    async load(symbol, interval, startDate, endDate, exchange = 'binance_futures') {
        const startMs = new Date(startDate).getTime();
        const endMs = new Date(endDate).getTime();
        const cacheKey = DataCache.generateKey(symbol, interval, startDate, endDate);
        const cached = await DataCache.get(cacheKey);
        if (cached && cached.length > 0) {
            this._emitProgress('cache_hit', 100, 100);
            return cached;
        }
        const isFutures = exchange === 'binance_futures';
        const baseUrl = isFutures ? BINANCE_FUTURES_BASE : BINANCE_SPOT_BASE;
        const endpoint = isFutures ? '/fapi/v1/klines' : '/api/v3/klines';
        const intervalMs = DataNormalizer.getIntervalMs(interval);
        const totalBarsEstimate = Math.ceil((endMs - startMs) / intervalMs);
        const totalRequests = Math.ceil(totalBarsEstimate / MAX_KLINES_PER_REQUEST);

        this.abortController = new AbortController();
        const allRawKlines = [];
        let cursor = startMs;
        let requestNum = 0;

        while (cursor < endMs) {
            if (this.abortController.signal.aborted) break;
            requestNum++;
            this._emitProgress('loading', requestNum, totalRequests);

            const url = `${baseUrl}${endpoint}?symbol=${symbol}&interval=${interval}&startTime=${cursor}&limit=${MAX_KLINES_PER_REQUEST}`;
            try {
                const response = await fetch(url, { signal: this.abortController.signal });
                if (!response.ok) {
                    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
                }
                const batch = await response.json();
                if (!batch || batch.length === 0) break;
                allRawKlines.push(...batch);
                const lastCloseTime = batch[batch.length - 1][6];
                cursor = lastCloseTime + 1;
                if (batch.length < MAX_KLINES_PER_REQUEST) break;
                await new Promise((r) => setTimeout(r, 100));
            } catch (err) {
                if (err.name === 'AbortError') break;
                throw err;
            }
        }

        const normalizedBars = DataNormalizer.normalize(allRawKlines, interval)
            .filter((b) => b.time >= startMs && b.time <= endMs);

        if (normalizedBars.length > 0) {
            await DataCache.set(cacheKey, normalizedBars);
        }
        this._emitProgress('done', totalRequests, totalRequests);
        return normalizedBars;
    }

    abort() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    _emitProgress(phase, current, total) {
        if (this.onProgress) {
            this.onProgress({
                phase,
                current,
                total,
                pct: total > 0 ? (current / total) * 100 : 0,
            });
        }
    }
}
