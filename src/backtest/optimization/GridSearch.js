// ─────────────────────────────────────────────────────────────────────────────
// GridSearch
// ─────────────────────────────────────────────────────────────────────────────

export class GridSearch {
    static generatePermutations(paramsConfig) {
        const keys = Object.keys(paramsConfig);
        const ranges = keys.map(key => {
            const config = paramsConfig[key];
            if (config.type === 'list') return config.values;

            const values = [];
            const { min, max, step = 1 } = config;
            for (let v = min; v <= max; v += step) {
                // Handle floating point precision issues
                values.push(Math.round(v * 10000) / 10000);
            }
            return values;
        });

        const permutations = [];
        const maxPerms = 50000; // Hard limit for safety

        const helper = (depth, current) => {
            if (permutations.length >= maxPerms) return;
            if (depth === keys.length) {
                permutations.push({ ...current });
                return;
            }
            const values = ranges[depth];
            const key = keys[depth];
            for (let i = 0; i < values.length; i++) {
                current[key] = values[i];
                helper(depth + 1, current);
            }
        };

        helper(0, {});
        return permutations;
    }
}
