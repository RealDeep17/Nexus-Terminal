// ─────────────────────────────────────────────────────────────────────────────
// MultiCondition, LookbackCondition, PersistCondition, TimeCondition
// ─────────────────────────────────────────────────────────────────────────────

export const MultiCondition = (params, context, evaluator) => {
    if (params.condition) {
        return evaluator.evaluate(
            { logic: 'AND', items: [params.condition] },
            context.getHTFContext(params.timeframe) || context
        );
    }
    return false;
};

export const LookbackCondition = (params, context, evaluator) => {
    const { condition, barsAgo = 1 } = params;
    if (!condition) return false;

    const pastIndex = context.barIndex - barsAgo;
    if (pastIndex < 0) return false;

    const pastContext = {
        bar: context.bars[pastIndex],
        barIndex: pastIndex,
        bars: context.bars,
        indicators: context.indicators,
        position: context.position,
        equity: context.equity,
        getIndicator: (indicatorId) => context.indicators[indicatorId.split('.')[0]]?.[indicatorId.split('.')[1] || 'value']?.[pastIndex] ?? null,
        getPrevIndicator: (indicatorId, ago = 1) => context.indicators[indicatorId.split('.')[0]]?.[indicatorId.split('.')[1] || 'value']?.[pastIndex - ago] ?? null,
        getPrice: (source) => {
            const b = context.bars[pastIndex];
            if (source === 'open') return b.open;
            if (source === 'high') return b.high;
            if (source === 'low') return b.low;
            if (source === 'hl2') return (b.high + b.low) / 2;
            return b.close;
        },
        getPrevBar: (ago = 1) => pastIndex - ago >= 0 ? context.bars[pastIndex - ago] : null,
        getHTFContext: () => null,
    };

    return evaluator.evaluate({ logic: 'AND', items: [condition] }, pastContext);
};

export const PersistCondition = (params, context, evaluator) => {
    const { condition, bars = 1 } = params;
    if (!condition) return false;

    for (let i = 0; i < bars; i++) {
        const isTrue = LookbackCondition({ condition, barsAgo: i }, context, evaluator);
        if (!isTrue) return false;
    }
    return true;
};

export const TimeCondition = (params, context) => {
    const { startHour, endHour, daysOfWeek } = params;
    const date = new Date(context.bar.time);

    if (daysOfWeek && daysOfWeek.length > 0) {
        const day = date.getUTCDay();
        if (!daysOfWeek.includes(day)) return false;
    }

    if (startHour !== undefined && endHour !== undefined) {
        const hour = date.getUTCHours();
        if (startHour < endHour) {
            if (hour < startHour || hour > endHour) return false;
        } else {
            if (hour < startHour && hour > endHour) return false;
        }
    }

    return true;
};
