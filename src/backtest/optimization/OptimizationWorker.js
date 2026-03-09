// ─────────────────────────────────────────────────────────────────────────────
// OptimizationWorker (WebWorker script)
// ─────────────────────────────────────────────────────────────────────────────

// Since this project runs in Vite, we can export this as a standard module 
// and import it using Vite's ?worker feature.

import BacktestRunner from '../engine/BacktestRunner.js';

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'RUN_BATCH') {
        const { batch, strategyTemplate, bars, additionalTFData } = payload;
        const results = [];

        // We create a fresh runner for this worker
        const runner = new BacktestRunner();
        // We deliberately do not attach progress reporting in workers here to avoid spamming the main thread

        for (let i = 0; i < batch.length; i++) {
            const params = batch[i].params;
            const pid = batch[i].id;

            // Inject params into strategy clone
            const strategyClone = JSON.parse(JSON.stringify(strategyTemplate));

            // Super simplistic injection for demo logic: 
            // Replace ${paramName} in string values or apply directly if it matches exactly
            // A more robust system would map specific keys directly to object paths
            _injectParams(strategyClone, params);

            try {
                const runRes = runner.run(strategyClone, bars, additionalTFData);
                // We only want to send back the score/metrics, not the massive trades array or equity curves 
                // to save structured cloning time across the worker boundary.
                results.push({
                    id: pid,
                    params,
                    metrics: {
                        netProfitPct: runRes.summary.netProfitPct,
                        winRate: runRes.summary.winRate,
                        sharpe: runRes.summary.sharpe,
                        maxDrawdown: runRes.summary.maxDrawdown,
                        totalTrades: runRes.summary.totalTrades
                    }
                });
            } catch (err) {
                results.push({
                    id: pid,
                    params,
                    error: err.message,
                    metrics: null
                });
            }
        }

        self.postMessage({ type: 'BATCH_COMPLETE', payload: { results } });
    }
};

function _injectParams(obj, params) {
    for (const k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
            _injectParams(obj[k], params);
        } else if (typeof obj[k] === 'string') {
            if (obj[k].startsWith('${') && obj[k].endsWith('}')) {
                const pName = obj[k].slice(2, -1);
                if (params[pName] !== undefined) {
                    obj[k] = params[pName];
                }
            }
        }
    }
}
