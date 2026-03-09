// ─────────────────────────────────────────────────────────────────────────────
// DataNormalizer — Formats raw Binance klines to engine format
// ─────────────────────────────────────────────────────────────────────────────

export default class DataNormalizer {
    static normalizeBinanceKlines(rawKlines) {
        return rawKlines.map((k) => {
            if (Array.isArray(k)) {
                return {
                    time: k[0],
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5]),
                    closeTime: k[6],
                    quoteVolume: parseFloat(k[7]),
                    trades: parseInt(k[8], 10),
                    takerBuyBaseVolume: parseFloat(k[9]),
                    takerBuyQuoteVolume: parseFloat(k[10]),
                };
            }
            return {
                time: k.time || k.openTime || k[0],
                open: parseFloat(k.open || k[1]),
                high: parseFloat(k.high || k[2]),
                low: parseFloat(k.low || k[3]),
                close: parseFloat(k.close || k[4]),
                volume: parseFloat(k.volume || k[5]),
                closeTime: k.closeTime || k[6],
                quoteVolume: parseFloat(k.quoteVolume || k[7] || 0),
                trades: parseInt(k.trades || k[8] || 0, 10),
                takerBuyBaseVolume: parseFloat(k.takerBuyBaseVolume || k[9] || 0),
                takerBuyQuoteVolume: parseFloat(k.takerBuyQuoteVolume || k[10] || 0),
            };
        });
    }

    static removeDuplicates(bars) {
        const seen = new Set();
        return bars.filter((bar) => {
            if (seen.has(bar.time)) return false;
            seen.add(bar.time);
            return true;
        });
    }

    static fillGaps(bars, intervalMs) {
        if (bars.length < 2) return bars;
        const filled = [bars[0]];
        for (let i = 1; i < bars.length; i++) {
            const prevTime = filled[filled.length - 1].time;
            const currTime = bars[i].time;
            const gap = currTime - prevTime;
            if (gap > intervalMs * 1.5) {
                const missingCount = Math.round(gap / intervalMs) - 1;
                const lastBar = filled[filled.length - 1];
                for (let j = 1; j <= missingCount; j++) {
                    filled.push({
                        time: prevTime + j * intervalMs,
                        open: lastBar.close,
                        high: lastBar.close,
                        low: lastBar.close,
                        close: lastBar.close,
                        volume: 0,
                        closeTime: prevTime + j * intervalMs + intervalMs - 1,
                        quoteVolume: 0,
                        trades: 0,
                        takerBuyBaseVolume: 0,
                        takerBuyQuoteVolume: 0,
                        synthetic: true,
                    });
                }
            }
            filled.push(bars[i]);
        }
        return filled;
    }

    static sortByTime(bars) {
        return [...bars].sort((a, b) => a.time - b.time);
    }

    static getIntervalMs(interval) {
        const map = {
            '1m': 60000,
            '3m': 180000,
            '5m': 300000,
            '15m': 900000,
            '30m': 1800000,
            '1h': 3600000,
            '2h': 7200000,
            '4h': 14400000,
            '6h': 21600000,
            '8h': 28800000,
            '12h': 43200000,
            '1d': 86400000,
            '3d': 259200000,
            '1w': 604800000,
            '1M': 2592000000,
        };
        return map[interval] || 3600000;
    }

    static normalize(rawKlines, interval) {
        let bars = DataNormalizer.normalizeBinanceKlines(rawKlines);
        bars = DataNormalizer.sortByTime(bars);
        bars = DataNormalizer.removeDuplicates(bars);
        bars = DataNormalizer.fillGaps(bars, DataNormalizer.getIntervalMs(interval));
        return bars;
    }
}
