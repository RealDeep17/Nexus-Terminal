// ─────────────────────────────────────────────────────────────────────────────
// CandleAttribute
// ─────────────────────────────────────────────────────────────────────────────

export const CandleAttribute = (params, context) => {
    const { attribute, operator, value } = params;
    const bar = context.bar;
    const prevBar = context.getPrevBar(1);

    const range = bar.high - bar.low;
    const body = Math.abs(bar.close - bar.open);

    let attrVal = 0;

    switch (attribute) {
        case 'bullish': return bar.close > bar.open;
        case 'bearish': return bar.close < bar.open;
        case 'body_pct':
            attrVal = range === 0 ? 0 : (body / range) * 100;
            break;
        case 'upper_wick_pct': {
            const uWick = bar.high - Math.max(bar.open, bar.close);
            attrVal = range === 0 ? 0 : (uWick / range) * 100;
            break;
        }
        case 'lower_wick_pct': {
            const lWick = Math.min(bar.open, bar.close) - bar.low;
            attrVal = range === 0 ? 0 : (lWick / range) * 100;
            break;
        }
        case 'gap_up':
            if (!prevBar) return false;
            attrVal = ((bar.open - prevBar.high) / prevBar.high) * 100;
            break;
        case 'gap_down':
            if (!prevBar) return false;
            attrVal = ((prevBar.low - bar.open) / prevBar.low) * 100;
            break;
        case 'range':
            attrVal = ((bar.high - bar.low) / bar.low) * 100;
            break;
        default:
            return false;
    }

    if (attribute === 'bullish' || attribute === 'bearish') return false;

    switch (operator) {
        case '>': return attrVal > value;
        case '>=': return attrVal >= value;
        case '<': return attrVal < value;
        case '<=': return attrVal <= value;
        case '==': return attrVal === value;
        case 'between': {
            const [min, max] = value;
            return attrVal >= min && attrVal <= max;
        }
        default: return false;
    }
};
