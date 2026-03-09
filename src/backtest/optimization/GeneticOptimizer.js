// ─────────────────────────────────────────────────────────────────────────────
// GeneticOptimizer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Basic Genetic Algorithm for Strategy Parameter Optimization
 */
export class GeneticOptimizer {
    constructor(paramsConfig, populationSize = 50, mutationRate = 0.1) {
        this.paramsConfig = paramsConfig;
        this.keys = Object.keys(paramsConfig);
        this.popSize = populationSize;
        this.mutRate = mutationRate;
    }

    generateInitialPopulation() {
        const pop = [];
        for (let i = 0; i < this.popSize; i++) {
            const individual = {};
            for (const key of this.keys) {
                individual[key] = this._randomGene(this.paramsConfig[key]);
            }
            pop.push(individual);
        }
        return pop;
    }

    evolve(populationWithScores) {
        // Sort descending by score
        const sorted = [...populationWithScores].sort((a, b) => b.score - a.score);

        // Keep top 20% (elitism)
        const eliteCount = Math.max(1, Math.floor(this.popSize * 0.2));
        const nextGen = sorted.slice(0, eliteCount).map(p => p.params);

        // Crossover to fill the rest
        while (nextGen.length < this.popSize) {
            const parentA = this._tournamentSelect(sorted);
            const parentB = this._tournamentSelect(sorted);
            let child = this._crossover(parentA, parentB);
            child = this._mutate(child);
            nextGen.push(child);
        }

        return nextGen;
    }

    _randomGene(config) {
        if (config.type === 'list') {
            return config.values[Math.floor(Math.random() * config.values.length)];
        }
        const { min, max, step = 1 } = config;
        const steps = Math.floor((max - min) / step);
        const randStep = Math.floor(Math.random() * (steps + 1));
        return Math.round((min + randStep * step) * 10000) / 10000;
    }

    _tournamentSelect(population, k = 3) {
        let best = null;
        for (let i = 0; i < k; i++) {
            const cand = population[Math.floor(Math.random() * population.length)];
            if (!best || cand.score > best.score) {
                best = cand;
            }
        }
        return best.params;
    }

    _crossover(parentA, parentB) {
        const child = {};
        for (const key of this.keys) {
            child[key] = Math.random() < 0.5 ? parentA[key] : parentB[key];
        }
        return child;
    }

    _mutate(individual) {
        const child = { ...individual };
        for (const key of this.keys) {
            if (Math.random() < this.mutRate) {
                child[key] = this._randomGene(this.paramsConfig[key]);
            }
        }
        return child;
    }
}
