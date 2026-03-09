// ─────────────────────────────────────────────────────────────────────────────
// FillSimulator
// ─────────────────────────────────────────────────────────────────────────────

export class FillSimulator {
    static simulateMarketFill(price, side, slippageModel, atr = null) {
        return slippageModel.apply(price, side, atr);
    }

    static simulateLimitFill(bar, limitPrice, direction, isNextBar = true) {
        if (direction === 'long') {
            if (bar.low <= limitPrice) {
                // If the open is below the limit price, we fill at the open (price gap)
                return Math.min(limitPrice, isNextBar ? bar.open : limitPrice);
            }
        } else {
            if (bar.high >= limitPrice) {
                // If the open is above the limit price, we fill at the open (price gap)
                return Math.max(limitPrice, isNextBar ? bar.open : limitPrice);
            }
        }
        return null;
    }

    static simulateStopFill(bar, stopPrice, direction, isNextBar = true, slippageModel = null, atr = null) {
        if (direction === 'long') {
            if (bar.high >= stopPrice) {
                let triggerPrice = stopPrice;
                if (isNextBar && bar.open >= stopPrice) {
                    triggerPrice = bar.open; // Gap over stop
                }
                return slippageModel ? slippageModel.apply(triggerPrice, 'buy', atr) : triggerPrice;
            }
        } else {
            if (bar.low <= stopPrice) {
                let triggerPrice = stopPrice;
                if (isNextBar && bar.open <= stopPrice) {
                    triggerPrice = bar.open; // Gap under stop
                }
                return slippageModel ? slippageModel.apply(triggerPrice, 'sell', atr) : triggerPrice;
            }
        }
        return null;
    }
}
