// ─────────────────────────────────────────────────────────────────────────────
// DrawdownAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

export class DrawdownAnalyzer {
    static getDrawdownPeriods(equityCurveData) {
        if (!equityCurveData || equityCurveData.length === 0) return [];

        const periods = [];
        let inDD = false;
        let ddStart = 0;
        let maxDD = 0;
        let troughTime = null;

        for (let i = 0; i < equityCurveData.length; i++) {
            const point = equityCurveData[i];
            const dd = point.drawdown || 0;

            if (dd > 0) {
                if (!inDD) {
                    inDD = true;
                    ddStart = i > 0 ? equityCurveData[i - 1].time : point.time;
                    maxDD = dd;
                    troughTime = point.time;
                } else {
                    if (dd > maxDD) {
                        maxDD = dd;
                        troughTime = point.time;
                    }
                }
            } else if (inDD) {
                // Recovered
                periods.push({
                    start: ddStart,
                    trough: troughTime,
                    end: point.time,
                    depth: maxDD,
                    durationBars: i - equityCurveData.findIndex(p => p.time === ddStart),
                });
                inDD = false;
                maxDD = 0;
            }
        }

        // Handle unrecovered drawdown
        if (inDD) {
            periods.push({
                start: ddStart,
                trough: troughTime,
                end: null, // Still in DD
                depth: maxDD,
                durationBars: equityCurveData.length - 1 - equityCurveData.findIndex(p => p.time === ddStart),
            });
        }

        return periods.sort((a, b) => b.depth - a.depth);
    }
}
