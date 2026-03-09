// ─────────────────────────────────────────────────────────────────────────────
// IndicatorSlope
// ─────────────────────────────────────────────────────────────────────────────

export const IndicatorSlope = (params, context) => {
    const { indicatorId, direction, periods = 1, minSlope = 0 } = params;

    const currVal = context.getIndicator(indicatorId);
    const pastVal = context.getPrevIndicator(indicatorId, periods);

    if (currVal === null || pastVal === null) return false;

    const diff = currVal - pastVal;

    if (direction === 'rising') return diff >= minSlope && diff > 0;
    if (direction === 'falling') return diff <= -minSlope && diff < 0;
    if (direction === 'flat') return Math.abs(diff) <= minSlope;

    return false;
};
