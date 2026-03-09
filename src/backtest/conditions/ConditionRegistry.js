export class ConditionRegistry {
    constructor() {
        this._registry = new Map();
        this._registerDefaults();
    }

    register(type, fn) { this._registry.set(type, fn); }
    get(type) { return this._registry.get(type) || null; }
    has(type) { return this._registry.has(type); }

    _registerDefaults() {
        // PRICE_CROSSES_UP: close crosses above threshold on this bar
        this.register('PRICE_ABOVE', (ctx, p) => ctx.bar.close > p.value);
        this.register('PRICE_BELOW', (ctx, p) => ctx.bar.close < p.value);
        this.register('PRICE_CROSSES_UP', (ctx, p) => {
            return ctx.prevBar && ctx.prevBar.close <= p.value && ctx.bar.close > p.value;
        });
        this.register('PRICE_CROSSES_DOWN', (ctx, p) => {
            return ctx.prevBar && ctx.prevBar.close >= p.value && ctx.bar.close < p.value;
        });
        this.register('INDICATOR_VALUE_THRESHOLD', (ctx, p) => {
            const val = ctx.getIndicator(p.indicatorId);
            if (val === null) return false;
            switch (p.operator) {
                case '>': return val > p.threshold;
                case '>=': return val >= p.threshold;
                case '<': return val < p.threshold;
                case '<=': return val <= p.threshold;
                case '==': return Math.abs(val - p.threshold) < 0.0001;
                default: return false;
            }
        });
        this.register('INDICATOR_CROSS_PRICE', (ctx, p) => {
            const curr = ctx.getIndicator(p.indicatorId);
            const prev = ctx.getPrevIndicator(p.indicatorId);
            if (curr === null || prev === null) return false;
            if (p.direction === 'cross_above') return prev < ctx.prevBar?.close && curr >= ctx.bar.close;
            if (p.direction === 'cross_below') return prev > ctx.prevBar?.close && curr <= ctx.bar.close;
            return false;
        });
        this.register('INDICATOR_CROSS_INDICATOR', (ctx, p) => {
            const currA = ctx.getIndicator(p.indicatorA);
            const currB = ctx.getIndicator(p.indicatorB);
            const prevA = ctx.getPrevIndicator(p.indicatorA);
            const prevB = ctx.getPrevIndicator(p.indicatorB);
            if ([currA, currB, prevA, prevB].some(v => v === null)) return false;
            if (p.direction === 'cross_above') return prevA <= prevB && currA > currB;
            if (p.direction === 'cross_below') return prevA >= prevB && currA < currB;
            return false;
        });
        this.register('INDICATOR_SLOPE', (ctx, p) => {
            const curr = ctx.getIndicator(p.indicatorId);
            const prev = ctx.getPrevIndicator(p.indicatorId);
            if (curr === null || prev === null) return false;
            if (p.direction === 'rising') return curr > prev;
            if (p.direction === 'falling') return curr < prev;
            return false;
        });
        this.register('VOLUME_CONDITION', (ctx, p) => {
            const volMa = ctx.getIndicator('volume_ma_20');
            if (volMa === null) return false;
            return ctx.bar.volume > volMa * (p.multiplier || 1.5);
        });
        this.register('BAR_PATTERN', (ctx, p) => {
            const b = ctx.bar;
            if (p.pattern === 'bullish_engulfing') {
                const pb = ctx.prevBar;
                if (!pb) return false;
                return pb.close < pb.open && b.close > b.open &&
                    b.open < pb.close && b.close > pb.open;
            }
            if (p.pattern === 'bearish_engulfing') {
                const pb = ctx.prevBar;
                if (!pb) return false;
                return pb.close > pb.open && b.close < b.open &&
                    b.open > pb.close && b.close < pb.open;
            }
            if (p.pattern === 'doji') {
                const bodySize = Math.abs(b.close - b.open);
                const totalRange = b.high - b.low;
                return totalRange > 0 && bodySize / totalRange < 0.1;
            }
            return false;
        });
    }
}
