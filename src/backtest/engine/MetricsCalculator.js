// ─────────────────────────────────────────────────────────────────────────────
// MetricsCalculator — Computes ALL performance metrics from trade log
// ─────────────────────────────────────────────────────────────────────────────

export default class MetricsCalculator {
    static calculate(trades, equityCurveData, initialCapital, riskFreeRate = 5) {
        if (!trades || trades.length === 0) {
            return MetricsCalculator._emptyMetrics(initialCapital);
        }
        const finalEquity = equityCurveData.length > 0
            ? equityCurveData[equityCurveData.length - 1].equity
            : initialCapital;

        const returns = MetricsCalculator._computeReturns(trades, equityCurveData, initialCapital, finalEquity, riskFreeRate);
        const tradeStats = MetricsCalculator._computeTradeStats(trades);
        const risk = MetricsCalculator._computeRiskMetrics(trades, equityCurveData, initialCapital);
        const riskAdjusted = MetricsCalculator._computeRiskAdjusted(equityCurveData, initialCapital, finalEquity, riskFreeRate, risk);
        const distribution = MetricsCalculator._computeDistribution(trades);

        return { returns, tradeStats, risk, riskAdjusted, distribution };
    }

    static _computeReturns(trades, equityCurveData, initialCapital, finalEquity, riskFreeRate) {
        const netProfit = finalEquity - initialCapital;
        const netProfitPct = (netProfit / initialCapital) * 100;
        const grossProfit = trades.filter((t) => t.grossPnl > 0).reduce((s, t) => s + t.grossPnl, 0);
        const grossLoss = Math.abs(trades.filter((t) => t.grossPnl < 0).reduce((s, t) => s + t.grossPnl, 0));
        const totalCommission = trades.reduce((s, t) => s + t.commission, 0);
        let totalDays = 1;
        if (trades.length >= 2) {
            totalDays = Math.max(1, (trades[trades.length - 1].exitTime - trades[0].entryTime) / (1000 * 86400));
        }
        const cagr = totalDays > 0
            ? (Math.pow(finalEquity / initialCapital, 365 / totalDays) - 1) * 100
            : 0;
        return {
            netProfit,
            netProfitPct,
            grossProfit,
            grossLoss,
            totalCommission,
            roc: netProfitPct,
            annualizedReturn: cagr,
            totalDays,
        };
    }

    static _computeTradeStats(trades) {
        const totalTrades = trades.length;
        const winners = trades.filter((t) => t.netPnl > 0);
        const losers = trades.filter((t) => t.netPnl < 0);
        const breakeven = trades.filter((t) => t.netPnl === 0);
        const winRate = totalTrades > 0 ? (winners.length / totalTrades) * 100 : 0;
        const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.netPnl, 0) / winners.length : 0;
        const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + t.netPnl, 0) / losers.length : 0;
        const avgWinPct = winners.length > 0 ? winners.reduce((s, t) => s + t.netPnlPct, 0) / winners.length : 0;
        const avgLossPct = losers.length > 0 ? losers.reduce((s, t) => s + t.netPnlPct, 0) / losers.length : 0;
        const largestWin = winners.length > 0 ? Math.max(...winners.map((t) => t.netPnl)) : 0;
        const largestLoss = losers.length > 0 ? Math.min(...losers.map((t) => t.netPnl)) : 0;
        const avgTradePnl = totalTrades > 0 ? trades.reduce((s, t) => s + t.netPnl, 0) / totalTrades : 0;
        const avgWinBars = winners.length > 0 ? winners.reduce((s, t) => s + t.barsInTrade, 0) / winners.length : 0;
        const avgLossBars = losers.length > 0 ? losers.reduce((s, t) => s + t.barsInTrade, 0) / losers.length : 0;
        const avgBars = totalTrades > 0 ? trades.reduce((s, t) => s + t.barsInTrade, 0) / totalTrades : 0;

        let maxConsecWins = 0, maxConsecLosses = 0, curWins = 0, curLosses = 0;
        let winStreakStart = 0, winStreakEnd = 0, lossStreakStart = 0, lossStreakEnd = 0;
        let bestStreakS = 0, bestStreakE = 0, worstStreakS = 0, worstStreakE = 0;
        for (let i = 0; i < trades.length; i++) {
            if (trades[i].netPnl > 0) {
                if (curWins === 0) winStreakStart = i;
                curWins++;
                curLosses = 0;
                if (curWins > maxConsecWins) {
                    maxConsecWins = curWins;
                    bestStreakS = winStreakStart;
                    bestStreakE = i;
                }
            } else if (trades[i].netPnl < 0) {
                if (curLosses === 0) lossStreakStart = i;
                curLosses++;
                curWins = 0;
                if (curLosses > maxConsecLosses) {
                    maxConsecLosses = curLosses;
                    worstStreakS = lossStreakStart;
                    worstStreakE = i;
                }
            } else {
                curWins = 0;
                curLosses = 0;
            }
        }

        const profitFactor = Math.abs(avgLoss) > 0 && losers.length > 0
            ? trades.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0) / Math.abs(trades.filter((t) => t.netPnl < 0).reduce((s, t) => s + t.netPnl, 0))
            : winners.length > 0 ? Infinity : 0;
        const expectedValue = (winRate / 100) * avgWin + ((100 - winRate) / 100) * avgLoss;
        const avgRMultiple = totalTrades > 0 ? trades.reduce((s, t) => s + (t.rMultiple || 0), 0) / totalTrades : 0;

        return {
            totalTrades,
            winningTrades: winners.length,
            losingTrades: losers.length,
            breakevenTrades: breakeven.length,
            winRate,
            avgWin, avgLoss, avgWinPct, avgLossPct,
            largestWin, largestLoss,
            avgTradePnl, avgWinBars, avgLossBars, avgBars,
            maxConsecWins, maxConsecLosses,
            winStreakDates: bestStreakE > 0 ? [trades[bestStreakS]?.entryTime, trades[bestStreakE]?.exitTime] : null,
            lossStreakDates: worstStreakE > 0 ? [trades[worstStreakS]?.entryTime, trades[worstStreakE]?.exitTime] : null,
            profitFactor, expectedValue, avgRMultiple,
        };
    }

    static _computeRiskMetrics(trades, equityCurveData, initialCapital) {
        let maxDD = 0, maxDDValue = 0, maxDDStart = 0, maxDDEnd = 0;
        let peak = initialCapital, trough = initialCapital, ddStart = 0;
        let totalDD = 0, ddCount = 0, inDD = false;
        let maxDDDuration = 0, currentDDDuration = 0;
        let recoveryTimes = [];
        let underwaterBars = 0;

        for (let i = 0; i < equityCurveData.length; i++) {
            const eq = equityCurveData[i].equity;
            if (eq >= peak) {
                if (inDD) {
                    recoveryTimes.push(currentDDDuration);
                    currentDDDuration = 0;
                    inDD = false;
                }
                peak = eq;
                trough = eq;
                ddStart = i;
            } else {
                underwaterBars++;
                if (!inDD) {
                    inDD = true;
                    currentDDDuration = 0;
                }
                currentDDDuration++;
                trough = Math.min(trough, eq);
                const dd = peak > 0 ? ((peak - trough) / peak) * 100 : 0;
                const ddVal = peak - trough;
                if (dd > maxDD) {
                    maxDD = dd;
                    maxDDValue = ddVal;
                    maxDDStart = ddStart;
                    maxDDEnd = i;
                }
                totalDD += equityCurveData[i].drawdown || 0;
                ddCount++;
                maxDDDuration = Math.max(maxDDDuration, currentDDDuration);
            }
        }

        const avgDD = ddCount > 0 ? totalDD / ddCount : 0;
        const avgRecovery = recoveryTimes.length > 0
            ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length : 0;
        const underwaterPct = equityCurveData.length > 0
            ? (underwaterBars / equityCurveData.length) * 100 : 0;

        const sortedPnls = [...trades.map((t) => t.netPnl)].sort((a, b) => a - b);
        const var95Idx = Math.floor(sortedPnls.length * 0.05);
        const var95 = sortedPnls.length > 0 ? sortedPnls[var95Idx] || sortedPnls[0] : 0;
        const tailLosses = sortedPnls.filter((p) => p <= var95);
        const cvar = tailLosses.length > 0 ? tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length : 0;

        return {
            maxDrawdown: maxDD,
            maxDrawdownValue: maxDDValue,
            maxDrawdownStart: maxDDStart < equityCurveData.length ? equityCurveData[maxDDStart]?.time : null,
            maxDrawdownEnd: maxDDEnd < equityCurveData.length ? equityCurveData[maxDDEnd]?.time : null,
            avgDrawdown: avgDD,
            maxDrawdownDuration: maxDDDuration,
            avgRecoveryTime: avgRecovery,
            underwaterPct,
            var95,
            cvar,
        };
    }

    static _computeRiskAdjusted(equityCurveData, initialCapital, finalEquity, riskFreeRate, risk) {
        const n = equityCurveData.length;
        if (n < 2) return { sharpe: 0, sortino: 0, calmar: 0, sterling: 0, omega: 0, ulcerIndex: 0, martinRatio: 0 };

        const returns = [];
        for (let i = 1; i < n; i++) {
            const prev = equityCurveData[i - 1].equity;
            if (prev > 0) returns.push((equityCurveData[i].equity - prev) / prev);
        }
        if (returns.length === 0) return { sharpe: 0, sortino: 0, calmar: 0, sterling: 0, omega: 0, ulcerIndex: 0, martinRatio: 0 };

        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        const annFactor = Math.sqrt(252);
        const annReturn = meanReturn * 252;
        const annStdDev = stdDev * annFactor;
        const rf = riskFreeRate / 100;

        const sharpe = annStdDev > 0 ? (annReturn - rf) / annStdDev : 0;

        const downside = returns.filter((r) => r < 0);
        const downsideVariance = downside.length > 0
            ? downside.reduce((s, r) => s + r * r, 0) / returns.length : 0;
        const downsideStdDev = Math.sqrt(downsideVariance) * annFactor;
        const sortino = downsideStdDev > 0 ? (annReturn - rf) / downsideStdDev : 0;

        const totalDays = n > 0 ? (equityCurveData[n - 1].time - equityCurveData[0].time) / (1000 * 86400) : 1;
        const cagr = totalDays > 0 ? (Math.pow(finalEquity / initialCapital, 365 / Math.max(totalDays, 1)) - 1) * 100 : 0;
        const calmar = risk.maxDrawdown > 0 ? cagr / risk.maxDrawdown : 0;
        const sterling = risk.avgDrawdown > 0 ? cagr / risk.avgDrawdown : 0;

        const threshold = 0;
        const gains = returns.filter((r) => r > threshold).reduce((s, r) => s + (r - threshold), 0);
        const losses = returns.filter((r) => r <= threshold).reduce((s, r) => s + (threshold - r), 0);
        const omega = losses > 0 ? gains / losses : gains > 0 ? Infinity : 0;

        const ddSquared = equityCurveData.reduce((s, d) => s + Math.pow(d.drawdown || 0, 2), 0);
        const ulcerIndex = n > 0 ? Math.sqrt(ddSquared / n) : 0;
        const martinRatio = ulcerIndex > 0 ? cagr / ulcerIndex : 0;

        return { sharpe, sortino, calmar, sterling, omega, ulcerIndex, martinRatio };
    }

    static _computeDistribution(trades) {
        const pnls = trades.map((t) => t.netPnl);
        const n = pnls.length;
        if (n === 0) return { mean: 0, median: 0, stdDev: 0, skewness: 0, kurtosis: 0, histogram: [] };

        const mean = pnls.reduce((a, b) => a + b, 0) / n;
        const sorted = [...pnls].sort((a, b) => a - b);
        const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
        const variance = pnls.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);

        let skewness = 0;
        let kurtosis = 0;
        if (stdDev > 0) {
            skewness = pnls.reduce((s, p) => s + Math.pow((p - mean) / stdDev, 3), 0) / n;
            kurtosis = pnls.reduce((s, p) => s + Math.pow((p - mean) / stdDev, 4), 0) / n - 3;
        }

        const buckets = 20;
        const min = sorted[0];
        const max = sorted[n - 1];
        const range = max - min || 1;
        const bucketSize = range / buckets;
        const histogram = new Array(buckets).fill(0).map((_, i) => ({
            min: min + i * bucketSize,
            max: min + (i + 1) * bucketSize,
            count: 0,
        }));
        for (const p of pnls) {
            const idx = Math.min(Math.floor((p - min) / bucketSize), buckets - 1);
            histogram[idx].count++;
        }

        return { mean, median, stdDev, skewness, kurtosis, histogram };
    }

    static _emptyMetrics(initialCapital) {
        return {
            returns: {
                netProfit: 0, netProfitPct: 0, grossProfit: 0, grossLoss: 0,
                totalCommission: 0, roc: 0, annualizedReturn: 0, totalDays: 0,
            },
            tradeStats: {
                totalTrades: 0, winningTrades: 0, losingTrades: 0, breakevenTrades: 0,
                winRate: 0, avgWin: 0, avgLoss: 0, avgWinPct: 0, avgLossPct: 0,
                largestWin: 0, largestLoss: 0, avgTradePnl: 0, avgWinBars: 0,
                avgLossBars: 0, avgBars: 0, maxConsecWins: 0, maxConsecLosses: 0,
                winStreakDates: null, lossStreakDates: null, profitFactor: 0,
                expectedValue: 0, avgRMultiple: 0,
            },
            risk: {
                maxDrawdown: 0, maxDrawdownValue: 0, maxDrawdownStart: null,
                maxDrawdownEnd: null, avgDrawdown: 0, maxDrawdownDuration: 0,
                avgRecoveryTime: 0, underwaterPct: 0, var95: 0, cvar: 0,
            },
            riskAdjusted: {
                sharpe: 0, sortino: 0, calmar: 0, sterling: 0, omega: 0,
                ulcerIndex: 0, martinRatio: 0,
            },
            distribution: {
                mean: 0, median: 0, stdDev: 0, skewness: 0, kurtosis: 0, histogram: [],
            },
        };
    }
}
