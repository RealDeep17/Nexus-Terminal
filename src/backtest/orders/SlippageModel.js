// ─────────────────────────────────────────────────────────────────────────────
// SlippageModel
// ─────────────────────────────────────────────────────────────────────────────

export class SlippageModel {
    constructor(type = 'none', value = 0) {
        this.type = type;
        this.value = value;
    }

    apply(price, side, atr = null) {
        if (this.type === 'none' || this.value === 0) {
            return price;
        }

        let slippageAmount = 0;

        switch (this.type) {
            case 'fixed_ticks':
            case 'fixed':
                slippageAmount = this.value;
                break;

            case 'percent':
                slippageAmount = price * (this.value / 100);
                break;

            case 'atr_fraction':
                if (atr !== null) {
                    slippageAmount = atr * this.value;
                } else {
                    // Fallback if no ATR available
                    slippageAmount = price * 0.001;
                }
                break;

            default:
                slippageAmount = 0;
        }

        // Buying costs more, selling yields less
        return side === 'buy' ? price + slippageAmount : price - slippageAmount;
    }
}
