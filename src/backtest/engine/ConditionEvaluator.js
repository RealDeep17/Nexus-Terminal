// ─────────────────────────────────────────────────────────────────────────────
// ConditionEvaluator — Evaluates entry/exit condition trees per bar
// ─────────────────────────────────────────────────────────────────────────────

import { getIndicatorValue, getPriceSource } from '../../indicators/index.js';

export default class ConditionEvaluator {
    constructor(conditionRegistry) {
        this.registry = conditionRegistry;
    }

    evaluate(conditionGroup, context) {
        if (!conditionGroup || !conditionGroup.items || conditionGroup.items.length === 0) {
            return false;
        }
        const logic = conditionGroup.logic || 'AND';
        if (logic === 'AND') {
            return conditionGroup.items.every((item) => this._evaluateItem(item, context));
        }
        return conditionGroup.items.some((item) => this._evaluateItem(item, context));
    }

    _evaluateItem(item, context) {
        if (item.logic) {
            return this.evaluate(item, context);
        }
        const evaluator = this.registry.get(item.type);
        if (!evaluator) {
            console.warn(`Unknown condition type: ${item.type}`);
            return false;
        }
        return evaluator(context, item.params);
    }

    evaluateFilters(filters, context) {
        if (!filters) return true;
        if (filters.sessionFilter && filters.sessionFilter.enabled) {
            const barDate = new Date(context.bar.time);
            const hour = barDate.getUTCHours();
            if (!filters.sessionFilter.allowedHours.includes(hour)) return false;
        }
        if (filters.trendFilter && filters.trendFilter.enabled) {
            const tf = filters.trendFilter;
            const id = `${tf.indicator.toLowerCase()}_${tf.period}`;
            const indicatorVal = getIndicatorValue(context.indicators, id, context.barIndex);
            if (indicatorVal === null) return true;
            const price = context.bar.close;
            if (tf.onlyLongAbove && context._direction === 'long' && price <= indicatorVal) return false;
            if (tf.onlyShortBelow && context._direction === 'short' && price >= indicatorVal) return false;
        }
        if (filters.volatilityFilter && filters.volatilityFilter.enabled) {
            const atrVal = getIndicatorValue(context.indicators, 'atr_14', context.barIndex);
            if (atrVal !== null) {
                if (filters.volatilityFilter.minATR && atrVal < filters.volatilityFilter.minATR) return false;
                if (filters.volatilityFilter.maxATR && filters.volatilityFilter.maxATR !== Infinity && atrVal > filters.volatilityFilter.maxATR) return false;
            }
        }
        return true;
    }
}
