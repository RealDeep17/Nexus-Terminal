// ─────────────────────────────────────────────────────────────────────────────
// PortfolioMetrics
// ─────────────────────────────────────────────────────────────────────────────

import MetricsCalculator from '../engine/MetricsCalculator.js';

export class PortfolioMetrics {
    static analyze(trades, equityCurveData, initialCapital, riskFreeRate = 5) {
        // Delegates to the core engine calculator, which is already comprehensive
        return MetricsCalculator.calculate(trades, equityCurveData, initialCapital, riskFreeRate);
    }

    static getMonthlyReturns(equityCurveData) {
        if (!equityCurveData || equityCurveData.length === 0) return {};

        const monthlyMap = {};
        let currentMonth = null;
        let monthStartEquity = 0;

        for (let i = 0; i < equityCurveData.length; i++) {
            const data = equityCurveData[i];
            const date = new Date(data.time);
            const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

            if (monthKey !== currentMonth) {
                if (currentMonth !== null) {
                    const endEquity = equityCurveData[i - 1].equity;
                    monthlyMap[currentMonth] = ((endEquity - monthStartEquity) / monthStartEquity) * 100;
                }
                currentMonth = monthKey;
                // Use previous bar's equity as start of month if possible
                monthStartEquity = i > 0 ? equityCurveData[i - 1].equity : data.equity;
            }
        }

        // Process final month
        if (currentMonth !== null) {
            const endEquity = equityCurveData[equityCurveData.length - 1].equity;
            monthlyMap[currentMonth] = ((endEquity - monthStartEquity) / monthStartEquity) * 100;
        }

        return monthlyMap;
    }
}
