// ─────────────────────────────────────────────────────────────────────────────
// IndicatorValueThreshold
// ─────────────────────────────────────────────────────────────────────────────

export const IndicatorValueThreshold = (params, context) => {
    const { indicatorId, operator, value, offsetBars = 0 } = params;

    const indVal = offsetBars > 0
        ? context.getPrevIndicator(indicatorId, offsetBars)
        : context.getIndicator(indicatorId);

    if (indVal === null) return false;

    switch (operator) {
        case '>': return indVal > value;
        case '>=': return indVal >= value;
        case '<': return indVal < value;
        case '<=': return indVal <= value;
        case '==': return indVal === value;
        case 'between': {
            const [min, max] = value;
            return indVal >= min && indVal <= max;
        }
        case 'outside': {
            const [min, max] = value;
            return indVal < min || indVal > max;
        }
        default: return false;
    }
};
