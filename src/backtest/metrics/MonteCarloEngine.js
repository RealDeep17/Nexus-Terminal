// ─────────────────────────────────────────────────────────────────────────────
// MonteCarloEngine
// ─────────────────────────────────────────────────────────────────────────────

export class MonteCarloEngine {
    static runSimulations(trades, initialCapital, numSimulations = 1000, maxDrawdownTarget = 20) {
        if (!trades || trades.length < 10) return null;

        const results = [];
        let ruinCount = 0;

        for (let i = 0; i < numSimulations; i++) {
            const simulatedCurve = this._simulateEquity(trades, initialCapital);
            results.push(simulatedCurve);

            if (simulatedCurve.maxDrawdown >= maxDrawdownTarget) {
                ruinCount++;
            }
        }

        // Calculate percentiles
        const finalEquities = results.map(r => r.finalEquity).sort((a, b) => a - b);
        const maxDrawdowns = results.map(r => r.maxDrawdown).sort((a, b) => a - b);

        const getPercentile = (arr, p) => {
            const index = Math.max(0, Math.floor((p / 100) * (arr.length - 1)));
            return arr[index];
        };

        return {
            simulations: results, // array of { curve[], maxDrawdown, finalEquity } 
            // *Note: passing full curve data for 1000 runs might be too heavy for UI,
            // in a real app we'd subset this or only return percentiles. We'll return
            // a subset of curves for rendering + stats.
            sampleCurves: results.slice(0, 100), // Only return 100 paths for UI drawing
            stats: {
                medianEquity: getPercentile(finalEquities, 50),
                p5Equity: getPercentile(finalEquities, 5),
                p95Equity: getPercentile(finalEquities, 95),
                meanEquity: finalEquities.reduce((a, b) => a + b, 0) / numSimulations,

                medianDD: getPercentile(maxDrawdowns, 50),
                p95DD: getPercentile(maxDrawdowns, 95),
                maxDD: maxDrawdowns[maxDrawdowns.length - 1],

                riskOfRuin: (ruinCount / numSimulations) * 100, // Probability of hitting maxDrawdownTarget
            }
        };
    }

    static _simulateEquity(trades, initialCapital) {
        // Create deeply cloned array of net PnLs
        const pnls = trades.map(t => t.netPnl);

        // Fisher-Yates shuffle
        for (let i = pnls.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pnls[i], pnls[j]] = [pnls[j], pnls[i]];
        }

        let equity = initialCapital;
        let peak = initialCapital;
        let maxDrawdown = 0;
        const curve = [equity];

        for (const pnl of pnls) {
            equity += pnl;
            if (equity > peak) peak = equity;

            const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
            if (dd > maxDrawdown) maxDrawdown = dd;

            curve.push(equity);
        }

        return {
            curve,
            maxDrawdown,
            finalEquity: equity
        };
    }
}
