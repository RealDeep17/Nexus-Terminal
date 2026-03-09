// ─────────────────────────────────────────────────────────────────────────────
// WalkForwardAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

export class WalkForwardAnalyzer {
    /**
     * Generates time windows for Walk-Forward Analysis
     * @param {Array} bars Historical requested bars
     * @param {number} numWindows How many folds/windows
     * @param {number} inSamplePct Percentage of window dedicated to training (e.g. 70)
     * @returns {Array} Array of window objects { trainStart, trainEnd, testStart, testEnd }
     */
    static generateWindows(bars, numWindows = 5, inSamplePct = 70) {
        if (!bars || bars.length < 100) return [];

        const totalBars = bars.length;
        // For a sliding window approach, we divide the data into (numWindows + 1) segments
        // Wait, simpler rolling window: 
        // Data is split into N equal segments.
        // Window 1: Train on chunk 1..k, Test on chunk k+1
        // Let's do a standard rolling window based on days.

        const startTime = bars[0].time;
        const endTime = bars[bars.length - 1].time;
        const totalDuration = endTime - startTime;

        // Define a step size such that we fit exactly numWindows tests
        const testDuration = totalDuration / (numWindows + (inSamplePct / (100 - inSamplePct)));
        const trainDuration = testDuration * (inSamplePct / (100 - inSamplePct));

        const windows = [];
        let currentStart = startTime;

        for (let i = 0; i < numWindows; i++) {
            const trainEnd = currentStart + trainDuration;
            const testEnd = trainEnd + testDuration;

            if (testEnd > endTime + 86400000) break; // Allow small overlap margin

            windows.push({
                id: i + 1,
                trainStart: currentStart,
                trainEnd: trainEnd,
                testStart: trainEnd,
                testEnd: testEnd,
            });

            // Shift window forward by the test duration for the next fold
            currentStart += testDuration;
        }

        return windows;
    }
}
