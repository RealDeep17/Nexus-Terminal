// ─────────────────────────────────────────────────────────────────────────────
// VolumeCondition
// ─────────────────────────────────────────────────────────────────────────────

export const VolumeCondition = (params, context) => {
    const { operator, type, value, candleDir = 'any' } = params;
    const bar = context.bar;

    if (candleDir === 'bull' && bar.close <= bar.open) return false;
    if (candleDir === 'bear' && bar.close >= bar.open) return false;

    let compareVal = bar.volume;

    if (type === 'relative_to_ma') {
        const volMA = context.getIndicator('volume_ma_20');
        if (volMA === null || volMA === 0) return false;
        compareVal = bar.volume / volMA;
    } else if (type === 'quote_volume') {
        compareVal = bar.quoteVolume || (bar.volume * bar.close);
    }

    switch (operator) {
        case '>': return compareVal > value;
        case '>=': return compareVal >= value;
        case '<': return compareVal < value;
        case '<=': return compareVal <= value;
        default: return false;
    }
};
