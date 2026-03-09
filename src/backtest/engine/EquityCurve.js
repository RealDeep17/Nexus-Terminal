// ─────────────────────────────────────────────────────────────────────────────
// EquityCurve — Builds equity curve data bar by bar
// ─────────────────────────────────────────────────────────────────────────────

export default class EquityCurve {
    constructor(initialCapital) {
        this.initialCapital = initialCapital;
        this.currentEquity = initialCapital;
        this.peakEquity = initialCapital;
        this.data = [];
        this.drawdownData = [];
    }

    update(time, realizedPnl, unrealizedPnl) {
        this.currentEquity += realizedPnl;
        const totalEquity = this.currentEquity + unrealizedPnl;
        this.peakEquity = Math.max(this.peakEquity, totalEquity);
        const drawdown = this.peakEquity > 0
            ? ((this.peakEquity - totalEquity) / this.peakEquity) * 100
            : 0;
        const drawdownValue = this.peakEquity - totalEquity;
        this.data.push({
            time,
            equity: totalEquity,
            realizedEquity: this.currentEquity,
            drawdown,
            drawdownValue,
            peakEquity: this.peakEquity,
        });
        this.drawdownData.push({
            time,
            value: -drawdown,
        });
        return { equity: totalEquity, drawdown };
    }

    applyTrade(tradeNetPnl) {
        this.currentEquity += tradeNetPnl;
    }

    getEquityAt(index) {
        if (index < 0 || index >= this.data.length) return this.initialCapital;
        return this.data[index].equity;
    }

    getCurrentEquity() {
        return this.currentEquity;
    }

    getResults() {
        return {
            curve: this.data,
            drawdownCurve: this.drawdownData,
            finalEquity: this.currentEquity,
            peakEquity: this.peakEquity,
            initialCapital: this.initialCapital,
        };
    }

    getBuyHoldCurve(bars, initialCapital) {
        if (bars.length === 0) return [];
        const startPrice = bars[0].close;
        const quantity = initialCapital / startPrice;
        return bars.map((bar) => ({
            time: bar.time,
            equity: quantity * bar.close,
        }));
    }
}
