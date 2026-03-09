// ─────────────────────────────────────────────────────────────────────────────
// AlertDataFeed — Supplies real-time + historical context to AlertEngine
// ─────────────────────────────────────────────────────────────────────────────

import { computeAllIndicators } from '../../indicators/index.js';

export class AlertDataFeed {
    constructor() {
        this.klinesCache = new Map(); // symbol -> klines[]
        this.priceCache = new Map();  // symbol -> current price
        this.wsConnections = new Map(); // symbol -> WebSocket
        this.onPriceTickCallback = null;
    }

    onPriceTick(callback) {
        this.onPriceTickCallback = callback;
    }

    async getLatestData(symbol, requiredIndicators = []) {
        // 1. Ensure we have kline background data
        if (!this.klinesCache.has(symbol)) {
            await this._fetchInitialKlines(symbol);
        }

        // 2. Ensure WebSocket is listening for live ticks
        this._ensureLiveConnection(symbol);

        const klines = this.klinesCache.get(symbol) || [];
        if (klines.length === 0) return null;

        const currentPrice = this.priceCache.get(symbol) || klines[klines.length - 1].close;

        // Create live current kline by cloning last closed kline and updating close/high/low
        const lastClosed = klines[klines.length - 1];
        const currentKline = {
            ...lastClosed,
            close: currentPrice,
            high: Math.max(lastClosed.high, currentPrice),
            low: Math.min(lastClosed.low, currentPrice),
        };

        // Calculate requested indicators on the fly
        // In a production system, you'd only compute exactly what's requested.
        // For simplicity here, we compute the common set if requested.
        let indicators = {};
        if (requiredIndicators.length > 0) {
            // Create a temporary array with the live kline appended
            const evalKlines = [...klines.slice(-500), currentKline];

            // We parse the requiredIndicators (e.g., ['EMA', 'RSI']) into configs
            const configs = this._buildIndicatorConfigs(requiredIndicators);
            indicators = computeAllIndicators(evalKlines, configs);
        }

        return {
            price: currentPrice,
            prevPrice: klines.length > 1 ? klines[klines.length - 2].close : currentPrice, // Approximate, actual tick prevPrice handled by WS stream if needed
            klines: klines.slice(-500),
            currentKline,
            prevKline: lastClosed,
            indicators,
        };
    }

    async _fetchInitialKlines(symbol) {
        try {
            const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=500`);
            const data = await res.json();
            const klines = data.map(k => ({
                time: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
            }));
            this.klinesCache.set(symbol, klines);
            if (!this.priceCache.has(symbol)) {
                this.priceCache.set(symbol, klines[klines.length - 1].close);
            }
        } catch (err) {
            console.warn(`Failed to fetch initial klines for ${symbol}`, err);
        }
    }

    _ensureLiveConnection(symbol) {
        if (this.wsConnections.has(symbol)) return;

        try {
            const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@ticker`);

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.c) {
                    const price = parseFloat(data.c);
                    this.priceCache.set(symbol, price);

                    if (this.onPriceTickCallback) {
                        this.onPriceTickCallback(symbol, price);
                    }
                }
            };

            ws.onerror = (err) => console.warn(`WS error for ${symbol}`, err);
            ws.onclose = () => {
                this.wsConnections.delete(symbol);
                // Attempt reconnect after 5s
                setTimeout(() => this._ensureLiveConnection(symbol), 5000);
            };

            this.wsConnections.set(symbol, ws);
        } catch (err) {
            console.warn(`Failed to connect WS for ${symbol}`, err);
        }
    }

    _buildIndicatorConfigs(requiredKeys) {
        const configs = [];
        const added = new Set();

        for (const key of requiredKeys) {
            if (added.has(key)) continue;
            added.add(key);

            if (key.startsWith('ema_')) {
                const period = parseInt(key.split('_')[1], 10);
                configs.push({ id: key, type: 'EMA', params: { period, source: 'close' } });
            } else if (key.startsWith('sma_')) {
                const period = parseInt(key.split('_')[1], 10);
                configs.push({ id: key, type: 'SMA', params: { period, source: 'close' } });
            } else if (key.startsWith('rsi_')) {
                const period = parseInt(key.split('_')[1], 10);
                configs.push({ id: key, type: 'RSI', params: { period, source: 'close' } });
            } else if (key.startsWith('bb_')) {
                const period = parseInt(key.split('_')[1], 10);
                configs.push({ id: key, type: 'BB', params: { period, stdDev: 2, source: 'close' } });
            } else if (key === 'macd') {
                configs.push({ id: key, type: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, source: 'close' } });
            } else if (key === 'vwap') {
                configs.push({ id: key, type: 'VWAP', params: {} });
            } else if (key.startsWith('atr_')) {
                const period = parseInt(key.split('_')[1], 10);
                configs.push({ id: key, type: 'ATR', params: { period } });
            }
        }
        return configs;
    }

    cleanup() {
        for (const ws of this.wsConnections.values()) {
            ws.close();
        }
        this.wsConnections.clear();
        this.klinesCache.clear();
        this.priceCache.clear();
    }
}
