// ─────────────────────────────────────────────────────────────────────────────
// StrategyValidator
// ─────────────────────────────────────────────────────────────────────────────

import { StrategySchema } from './StrategySchema.js';

export class StrategyValidator {
    static validate(strategy) {
        const errors = [];

        if (!strategy.name) {
            errors.push('Strategy name is required.');
        }
        if (!strategy.universe || !strategy.universe.symbol) {
            errors.push('Universe symbol is required.');
        }
        if (!strategy.entryRule || !strategy.entryRule.conditions || !strategy.entryRule.conditions.items.length) {
            errors.push('At least one entry condition is required.');
        }
        if (strategy.entryRule && strategy.entryRule.sizing) {
            if (strategy.entryRule.sizing.value <= 0) {
                errors.push('Position sizing value must be greater than 0.');
            }
        }

        // Validate entry conditions structure recursively
        this._validateConditionTree(strategy.entryRule?.conditions, 'Entry', errors);

        // Validate exit conditions if present
        if (strategy.exitRule?.conditions?.items?.length > 0) {
            this._validateConditionTree(strategy.exitRule.conditions, 'Exit', errors);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    static _validateConditionTree(node, prefix, errors) {
        if (!node) return;
        if (node.logic && Array.isArray(node.items)) {
            node.items.forEach((item, index) => {
                this._validateConditionTree(item, `${prefix} Condition ${index + 1}`, errors);
            });
        } else if (node.type && node.params) {
            // Validate individual condition params based on type
            if (node.type.includes('indicator_cross') && !node.params.indicatorId && !node.params.indicatorA) {
                errors.push(`${prefix}: Missing indicator parameter.`);
            }
        } else {
            errors.push(`${prefix}: Invalid condition structure.`);
        }
    }
}
