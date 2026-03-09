// src/api/binance.js — Smart progressive kline loader
// Phase 1: last 500 bars  (instant render)
// Phase 2: parallel back-fill to ~2000 bars  (background, no UI block)
// Phase 3: on-demand infinite scroll backward  (triggered by left-edge scroll)

const BASE_URL = 'https://fapi.binance.com';
const BARS_PER_REQUEST = 1500; // Binance max per request — maximizes throughput

// ─── Interval → milliseconds ──────────────────────────────────────────────────
export const TF_MS = {
    '1m': 60_000,
    '3m': 180_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '2h': 7_200_000,
    '4h': 14_400_000,
    '6h': 21_600_000,
    '8h': 28_800_000,
    '12h': 43_200_000,
    '1d': 86_400_000,
    '3d': 259_200_000,
    '1w': 604_800_000,
    '1M': 2_592_000_000,
};

// ─── How many bars to back-fill in Phase 2 per timeframe ─────────────────────
const PHASE2_BARS = {
    '1m': 4500,
    '3m': 4500,
    '5m': 4500,
    '15m': 4500,
    '30m': 4500,
    '1h': 4500,
    '2h': 4500,
    '4h': 4500,
    '6h': 4500,
    '8h': 4500,
    '12h': 4500,
    '1d': 4500,
    '3d': 3000,
    '1w': 1500,
    '1M': 500,
};

// ─── Parse raw Binance kline array ───────────────────────────────────────────
function parseKline(k) {
    return {
        time: Math.floor(k[0] / 1000), // ms → seconds (lightweight-charts)
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
    };
}

// ─── Core: fetch one chunk with optional time bounds ─────────────────────────
async function fetchChunk(symbol, interval, { startTime, endTime, limit } = {}) {
    let url = `${BASE_URL}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit ?? BARS_PER_REQUEST}`;
    if (startTime) url += `&startTime=${startTime}`;
    if (endTime) url += `&endTime=${endTime}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return raw.map(parseKline);
}

// ─── Deduplicate + sort helper ────────────────────────────────────────────────
export function mergeAndSort(existing, incoming) {
    const map = new Map();
    for (const b of existing) map.set(b.time, b);
    for (const b of incoming) map.set(b.time, b);
    const out = Array.from(map.values());
    out.sort((a, b) => a.time - b.time);
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — Last 500 bars, single request, instant
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchLatestBars(symbol, interval, count = 500) {
    try {
        return await fetchChunk(symbol, interval, { limit: Math.min(count, 1500) });
    } catch (err) {
        console.error('[NEXUS] Phase 1 failed:', err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Parallel back-fill from oldestTime backwards
// Splits the target window into 500-bar chunks and fires them all at once
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchBackfill(symbol, interval, oldestTimeMs) {
    try {
        const tfMs = TF_MS[interval] ?? 3_600_000;
        const targetBars = PHASE2_BARS[interval] ?? 2000;
        const windowMs = targetBars * tfMs;
        const startMs = oldestTimeMs - windowMs;
        const endMs = oldestTimeMs - 1; // one ms before the bar we already have

        // Split into 500-bar chunks, fired in parallel
        const chunkDuration = BARS_PER_REQUEST * tfMs;
        const chunks = [];
        let cursor = startMs;
        while (cursor < endMs) {
            const chunkEnd = Math.min(cursor + chunkDuration - 1, endMs);
            chunks.push({ startTime: cursor, endTime: chunkEnd, limit: BARS_PER_REQUEST });
            cursor += chunkDuration;
        }

        if (chunks.length === 0) return [];

        console.log(`[NEXUS] Phase 2: ${chunks.length} parallel chunks for ${symbol} ${interval}`);

        const results = await Promise.all(
            chunks.map(opts =>
                fetchChunk(symbol, interval, opts).catch(err => {
                    console.warn('[NEXUS] Phase 2 chunk failed:', err.message);
                    return [];
                })
            )
        );

        return results.flat();
    } catch (err) {
        console.error('[NEXUS] Phase 2 failed:', err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — Infinite scroll: load one more page (500 bars) before current oldest
// Called when user scrolls to the left edge
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchOlderBars(symbol, interval, oldestTimeMs) {
    try {
        const tfMs = TF_MS[interval] ?? 3_600_000;
        const endMs = oldestTimeMs - 1;
        const startMs = endMs - BARS_PER_REQUEST * tfMs;

        return await fetchChunk(symbol, interval, {
            startTime: startMs,
            endTime: endMs,
            limit: BARS_PER_REQUEST,
        });
    } catch (err) {
        console.error('[NEXUS] Phase 3 fetch failed:', err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy compat: old single-call fetchKlines still works (used by DataTab etc)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchKlines(symbol, interval, limit = 500) {
    return fetchLatestBars(symbol, interval, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Explicit date range fetch (for backtesting)
// e.g. fetchKlinesRange('BTCUSDT', '1d', '2020-01-01', '2023-01-01')
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchKlinesRange(symbol, interval, fromDate, toDate) {
    try {
        const tfMs = TF_MS[interval] ?? 3_600_000;
        const startMs = new Date(fromDate).getTime();
        const endMs = new Date(toDate).getTime();

        const chunkDuration = BARS_PER_REQUEST * tfMs;
        const chunks = [];
        let cursor = startMs;
        while (cursor < endMs) {
            const chunkEnd = Math.min(cursor + chunkDuration - 1, endMs);
            chunks.push({ startTime: cursor, endTime: chunkEnd, limit: BARS_PER_REQUEST });
            cursor += chunkDuration;
        }

        console.log(`[NEXUS] Range fetch: ${chunks.length} parallel chunks for ${symbol} ${interval} (${fromDate} → ${toDate})`);

        const results = await Promise.all(
            chunks.map(opts => fetchChunk(symbol, interval, opts).catch(() => []))
        );

        return mergeAndSort([], results.flat());
    } catch (err) {
        console.error('[NEXUS] fetchKlinesRange failed:', err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// REST helpers (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchTicker24hr(symbol) {
    try {
        const res = await fetch(`${BASE_URL}/fapi/v1/ticker/24hr?symbol=${symbol}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) { console.error('fetchTicker24hr:', err); return null; }
}

export async function fetchAllTickers() {
    try {
        const res = await fetch(`${BASE_URL}/fapi/v1/ticker/24hr`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const map = new Map();
        for (const item of data) map.set(item.symbol, item);
        return map;
    } catch (err) { console.error('fetchAllTickers:', err); return new Map(); }
}

export async function fetchPremiumIndex(symbol) {
    try {
        const res = await fetch(`${BASE_URL}/fapi/v1/premiumIndex?symbol=${symbol}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) { console.error('fetchPremiumIndex:', err); return null; }
}

export async function fetchOpenInterest(symbol) {
    try {
        const res = await fetch(`${BASE_URL}/fapi/v1/openInterest?symbol=${symbol}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) { console.error('fetchOpenInterest:', err); return null; }
}

export async function fetchLongShortRatio(symbol, period = '5m') {
    try {
        const url = `${BASE_URL}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.length > 0 ? data[0] : null;
    } catch (err) { console.error('fetchLongShortRatio:', err); return null; }
}

export async function fetchServerTime() {
    try {
        const res = await fetch(`${BASE_URL}/fapi/v1/time`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()).serverTime;
    } catch { return Date.now(); }
}

export async function fetchExchangeInfo() {
    try {
        const res = await fetch(`${BASE_URL}/fapi/v1/exchangeInfo`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.symbols
            .filter(s => s.status === 'TRADING' && s.contractType === 'PERPETUAL')
            .map(s => ({ symbol: s.symbol, baseAsset: s.baseAsset, quoteAsset: s.quoteAsset }));
    } catch (err) { console.error('fetchExchangeInfo:', err); return []; }
}

export async function fetchDepth(symbol, limit = 10) {
    try {
        const res = await fetch(`${BASE_URL}/fapi/v1/depth?symbol=${symbol}&limit=${limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) { console.error('fetchDepth:', err); return null; }
}
