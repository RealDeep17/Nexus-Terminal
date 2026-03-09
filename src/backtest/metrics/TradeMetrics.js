// ─────────────────────────────────────────────────────────────────────────────
// TradeMetrics
// ─────────────────────────────────────────────────────────────────────────────

// Note: Most of the heavy lifting is in engine/MetricsCalculator.js. 
// This file serves as an extended utility module if needed for custom trade-specific analysis.

import MetricsCalculator from '../engine/MetricsCalculator.js';

export class TradeMetrics {
    static getDistribution(trades) {
        return MetricsCalculator._computeDistribution(trades);
    }

    static getStreaks(trades) {
        const stats = MetricsCalculator._computeTradeStats(trades);
        return {
            maxConsecWins: stats.maxConsecWins,
            maxConsecLosses: stats.maxConsecLosses,
            winStreakDates: stats.winStreakDates,
            lossStreakDates: stats.lossStreakDates,
        };
    }

    static getMAE_MFE(trades) {
        if (!trades || trades.length === 0) return { avgMFE: 0, avgMAE: 0, ratio: 0 };

        let totalMFE = 0;
        let totalMAE = 0;

        for (const t of trades) {
            totalMFE += t.mfePct || 0;
            totalMAE += t.maePct || 0;
        }

        const avgMFE = totalMFE / trades.length;
        const avgMAE = totalMAE / trades.length;

        return {
            avgMFE,
            avgMAE,
            ratio: avgMAE !== 0 ? Math.abs(avgMFE / avgMAE) : avgMFE > 0 ? Infinity : 0,
        };
    }
}
