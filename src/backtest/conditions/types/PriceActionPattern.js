// ─────────────────────────────────────────────────────────────────────────────
// PriceActionPattern
// ─────────────────────────────────────────────────────────────────────────────

export const PriceActionPattern = (params, context) => {
    const { pattern, minBodyPct = 0 } = params;

    const curr = context.bar;
    const prev = context.getPrevBar(1);
    const prev2 = context.getPrevBar(2);

    const range = (bar) => bar.high - bar.low;
    const body = (bar) => Math.abs(bar.close - bar.open);
    const isBull = (bar) => bar.close > bar.open;
    const isBear = (bar) => bar.close < bar.open;
    const upperWick = (bar) => bar.high - Math.max(bar.open, bar.close);
    const lowerWick = (bar) => Math.min(bar.open, bar.close) - bar.low;

    const bodyPct = (bar) => range(bar) === 0 ? 0 : body(bar) / range(bar);

    switch (pattern) {
        case 'doji':
            return bodyPct(curr) <= 0.05;

        case 'hammer':
            return isBull(curr) && lowerWick(curr) >= body(curr) * 2 && upperWick(curr) <= body(curr) * 0.5;

        case 'inverted_hammer':
            return isBull(curr) && upperWick(curr) >= body(curr) * 2 && lowerWick(curr) <= body(curr) * 0.5;

        case 'bullish_engulfing':
            if (!prev) return false;
            return isBear(prev) && isBull(curr) &&
                curr.close > prev.open && curr.open < prev.close &&
                bodyPct(curr) >= (minBodyPct / 100);

        case 'bearish_engulfing':
            if (!prev) return false;
            return isBull(prev) && isBear(curr) &&
                curr.close < prev.open && curr.open > prev.close &&
                bodyPct(curr) >= (minBodyPct / 100);

        case 'morning_star':
            if (!prev || !prev2) return false;
            return isBear(prev2) && bodyPct(prev2) > 0.5 &&
                bodyPct(prev) <= 0.1 && prev.open < prev2.close &&
                isBull(curr) && curr.close > (prev2.open + prev2.close) / 2;

        case 'evening_star':
            if (!prev || !prev2) return false;
            return isBull(prev2) && bodyPct(prev2) > 0.5 &&
                bodyPct(prev) <= 0.1 && prev.open > prev2.close &&
                isBear(curr) && curr.close < (prev2.open + prev2.close) / 2;

        case 'shooting_star':
            return isBear(curr) && upperWick(curr) >= body(curr) * 2 && lowerWick(curr) <= body(curr) * 0.5;

        case 'spinning_top':
            return bodyPct(curr) <= 0.3 && upperWick(curr) > body(curr) && lowerWick(curr) > body(curr);

        case 'marubozu_bull':
            return isBull(curr) && upperWick(curr) <= range(curr) * 0.05 && lowerWick(curr) <= range(curr) * 0.05;

        case 'marubozu_bear':
            return isBear(curr) && upperWick(curr) <= range(curr) * 0.05 && lowerWick(curr) <= range(curr) * 0.05;

        case 'inside_bar':
            if (!prev) return false;
            return curr.high < prev.high && curr.low > prev.low;

        case 'outside_bar':
            if (!prev) return false;
            return curr.high > prev.high && curr.low < prev.low;

        case 'pin_bar_bull':
            return lowerWick(curr) >= range(curr) * 0.6 && upperWick(curr) <= range(curr) * 0.1;

        case 'pin_bar_bear':
            return upperWick(curr) >= range(curr) * 0.6 && lowerWick(curr) <= range(curr) * 0.1;

        case 'three_white_soldiers':
            if (!prev || !prev2) return false;
            return isBull(prev2) && isBull(prev) && isBull(curr) &&
                prev.close > prev2.close && curr.close > prev.close &&
                prev.open > prev2.open && prev.open < prev2.close &&
                curr.open > prev.open && curr.open < prev.close &&
                upperWick(curr) <= range(curr) * 0.1;

        case 'three_black_crows':
            if (!prev || !prev2) return false;
            return isBear(prev2) && isBear(prev) && isBear(curr) &&
                prev.close < prev2.close && curr.close < prev.close &&
                prev.open < prev2.open && prev.open > prev2.close &&
                curr.open < prev.open && curr.open > prev.close &&
                lowerWick(curr) <= range(curr) * 0.1;

        default:
            return false;
    }
};
