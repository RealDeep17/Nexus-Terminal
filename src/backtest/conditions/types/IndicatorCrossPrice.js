// ─────────────────────────────────────────────────────────────────────────────
// IndicatorCrossPrice
// ─────────────────────────────────────────────────────────────────────────────

export const IndicatorCrossPrice = (params, context) => {
    const { indicatorId, priceSource = 'close', direction = 'either' } = params;

    const currInd = context.getIndicator(indicatorId);
    const prevInd = context.getPrevIndicator(indicatorId, 1);

    const currPrice = context.getPrice(priceSource);
    const prevPriceObj = context.getPrevBar(1);
    const prevPrice = prevPriceObj ? prevPriceObj[priceSource] || prevPriceObj.close : null;

    if (currInd === null || prevInd === null || currPrice === null || prevPrice === null) {
        return false;
    }

    const crossedAbove = prevInd < prevPrice && currInd >= currPrice;
    const crossedBelow = prevInd > prevPrice && currInd <= currPrice;

    if (direction === 'cross_above') return crossedAbove;
    if (direction === 'cross_below') return crossedBelow;
    return crossedAbove || crossedBelow;
};
