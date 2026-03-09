// ─────────────────────────────────────────────────────────────────────────────
// Optimizer Main Controller 
// ─────────────────────────────────────────────────────────────────────────────

import { GridSearch } from './GridSearch.js';
import { GeneticOptimizer } from './GeneticOptimizer.js';

export class Optimizer {
    constructor(strategyTemplate, paramsConfig, bars, objectiveFn = 'netProfitPct') {
        this.strategyTemplate = strategyTemplate;
        this.paramsConfig = paramsConfig;
        this.bars = bars;
        this.objectiveFn = objectiveFn;

        const maxWorkers = navigator.hardwareConcurrency ? navigator.hardwareConcurrency - 1 : 3;
        this.numWorkers = Math.max(1, maxWorkers);
        this.workers = [];
    }

    async runGridSearch(onProgress) {
        const perms = GridSearch.generatePermutations(this.paramsConfig);
        const runs = perms.map((p, i) => ({ id: `run_${i}`, params: p }));
        return this._distributeWork(runs, onProgress);
    }

    async runGenetic(generations = 10, popSize = 50, onProgress) {
        const algo = new GeneticOptimizer(this.paramsConfig, popSize);
        let population = algo.generateInitialPopulation();
        let bestOverall = null;
        let allResults = [];

        for (let g = 0; g < generations; g++) {
            if (onProgress) onProgress({ phase: 'generation', current: g + 1, total: generations });

            const runs = population.map((p, i) => ({ id: `g${g}_r${i}`, params: p }));
            const genResults = await this._distributeWork(runs, null); // Don't report internal chunk progress

            // Score results
            const scoredPop = genResults.map(res => {
                let score = -99999;
                if (res.metrics && res.metrics.totalTrades > 0) {
                    score = res.metrics[this.objectiveFn] || 0;
                }
                return { params: res.params, score, metrics: res.metrics };
            });

            allResults.push(...scoredPop);

            // Track best
            const genBest = [...scoredPop].sort((a, b) => b.score - a.score)[0];
            if (!bestOverall || genBest.score > bestOverall.score) {
                bestOverall = genBest;
            }

            if (g < generations - 1) {
                population = algo.evolve(scoredPop);
            }
        }

        // Sort all results for the heatmap
        allResults.sort((a, b) => b.score - a.score);
        return allResults;
    }

    async _distributeWork(runs, onProgress) {
        if (runs.length === 0) return [];

        // Lazy init workers using Vite special worker import path
        if (this.workers.length === 0) {
            for (let i = 0; i < this.numWorkers; i++) {
                const worker = new Worker(new URL('./OptimizationWorker.js', import.meta.url), { type: 'module' });
                this.workers.push(worker);
            }
        }

        return new Promise((resolve) => {
            const results = [];
            let completedBatches = 0;
            let totalRunsCompleted = 0;
            const totalRuns = runs.length;

            // Split into batches
            const batchSize = Math.max(1, Math.ceil(runs.length / this.numWorkers));
            const batches = [];
            for (let i = 0; i < runs.length; i += batchSize) {
                batches.push(runs.slice(i, i + batchSize));
            }

            const activeWorkers = Math.min(this.numWorkers, batches.length);

            for (let i = 0; i < activeWorkers; i++) {
                const worker = this.workers[i];

                worker.onmessage = (e) => {
                    if (e.data.type === 'BATCH_COMPLETE') {
                        const batchResults = e.data.payload.results;
                        results.push(...batchResults);
                        completedBatches++;
                        totalRunsCompleted += batchResults.length;

                        if (onProgress) {
                            onProgress({ phase: 'grid_eval', current: totalRunsCompleted, total: totalRuns });
                        }

                        if (completedBatches === activeWorkers) {
                            resolve(results);
                        }
                    }
                };

                // Dispatch
                worker.postMessage({
                    type: 'RUN_BATCH',
                    payload: {
                        batch: batches[i],
                        strategyTemplate: this.strategyTemplate,
                        bars: this.bars,
                        additionalTFData: {}
                    }
                });
            }
        });
    }

    terminate() {
        for (const w of this.workers) {
            w.terminate();
        }
        this.workers = [];
    }
}
