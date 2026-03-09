// ─────────────────────────────────────────────────────────────────────────────
// IndicatorCrossIndicator
// ─────────────────────────────────────────────────────────────────────────────

export const IndicatorCrossIndicator = (params, context) => {
    const { indicatorA, indicatorB, direction = 'either' } = params;

    const currA = context.getIndicator(indicatorA);
    const prevA = context.getPrevIndicator(indicatorA, 1);

    const currB = context.getIndicator(indicatorB);
    const prevB = context.getPrevIndicator(indicatorB, 1);

    if (currA === null || prevA === null || currB === null || prevB === null) {
        return false;
    }

    const crossedAbove = prevA < prevB && currA >= currB;
    const crossedBelow = prevA > prevB && currA <= currB;

    if (direction === 'cross_above') return crossedAbove;
    if (direction === 'cross_below') return crossedBelow;
    return crossedAbove || crossedBelow;
};
