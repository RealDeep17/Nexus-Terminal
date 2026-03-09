// ─────────────────────────────────────────────────────────────────────────────
// RiskManager — Position sizing, max drawdown guards, consecutive loss limits
// ─────────────────────────────────────────────────────────────────────────────

export default class RiskManager {
    constructor(filters = {}) {
        this.maxConsecutiveLosses = filters.maxConsecutiveLosses || Infinity;
        this.maxDailyDrawdown = filters.maxDailyDrawdown || Infinity;
        this.maxTotalDrawdown = filters.maxTotalDrawdown || Infinity;
        this.consecutiveLosses = 0;
        this.peakEquity = 0;
        this.dailyStartEquity = 0;
        this.currentDay = null;
        this.halted = false;
        this.haltReason = null;
    }

    calculatePositionSize(sizing, equity, entryPrice, stopLossPrice = null) {
        let quantity = 0;
        switch (sizing.type) {
            case 'fixed_usdt': {
                quantity = sizing.value / entryPrice;
                break;
            }
            case 'percent_equity': {
                const allocatedCapital = equity * (sizing.value / 100);
                quantity = allocatedCapital / entryPrice;
                break;
            }
            case 'fixed_contracts': {
                quantity = sizing.value;
                break;
            }
            case 'risk_percent': {
                if (stopLossPrice === null || stopLossPrice === entryPrice) {
                    const allocatedCapital = equity * (sizing.value / 100);
                    quantity = allocatedCapital / entryPrice;
                } else {
                    const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
                    const riskAmount = equity * (sizing.value / 100);
                    quantity = riskPerUnit > 0 ? riskAmount / riskPerUnit : equity * 0.01 / entryPrice;
                }
                break;
            }
            case 'kelly': {
                const f = sizing._kellyFraction || 0.1;
                const halfKelly = f / 2;
                const allocatedCapital = equity * Math.max(0, Math.min(halfKelly, 0.25));
                quantity = allocatedCapital / entryPrice;
                break;
            }
            default: {
                const allocatedCapital = equity * 0.1;
                quantity = allocatedCapital / entryPrice;
                break;
            }
        }
        return Math.max(quantity, 0);
    }

    calculateStopLossPrice(entryPrice, direction, stopLossConfig, atrValue = null) {
        if (!stopLossConfig || !stopLossConfig.enabled) return null;
        let distance = 0;
        switch (stopLossConfig.type) {
            case 'percent':
                distance = entryPrice * (stopLossConfig.value / 100);
                break;
            case 'atr':
                distance = atrValue !== null ? atrValue * stopLossConfig.value : entryPrice * 0.02;
                break;
            case 'fixed':
                distance = stopLossConfig.value;
                break;
            default:
                distance = entryPrice * 0.02;
                break;
        }
        return direction === 'long' ? entryPrice - distance : entryPrice + distance;
    }

    calculateTakeProfitPrice(entryPrice, direction, tpConfig, atrValue = null, stopLossDistance = 0) {
        if (!tpConfig || !tpConfig.enabled) return null;
        let distance = 0;
        switch (tpConfig.type) {
            case 'percent':
                distance = entryPrice * (tpConfig.value / 100);
                break;
            case 'atr':
                distance = atrValue !== null ? atrValue * tpConfig.value : entryPrice * 0.04;
                break;
            case 'risk_reward':
                distance = stopLossDistance * tpConfig.value;
                break;
            case 'fixed':
                distance = tpConfig.value;
                break;
            default:
                distance = entryPrice * 0.04;
                break;
        }
        return direction === 'long' ? entryPrice + distance : entryPrice - distance;
    }

    calculateTrailingStopPrice(entryPrice, direction, stopLossConfig) {
        if (!stopLossConfig || !stopLossConfig.trailingEnabled) return null;
        return this.calculateStopLossPrice(entryPrice, direction, {
            enabled: true,
            type: stopLossConfig.trailingType || 'percent',
            value: stopLossConfig.trailingValue || stopLossConfig.value,
        });
    }

    calculateInitialRisk(entryPrice, stopLossPrice, quantity) {
        if (stopLossPrice === null) return 0;
        return Math.abs(entryPrice - stopLossPrice) * quantity;
    }

    checkRiskGuards(equity, bar) {
        if (this.halted) return false;
        const barDay = new Date(bar.time).toISOString().slice(0, 10);
        if (barDay !== this.currentDay) {
            this.currentDay = barDay;
            this.dailyStartEquity = equity;
        }
        if (this.peakEquity === 0) this.peakEquity = equity;
        this.peakEquity = Math.max(this.peakEquity, equity);
        if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
            this.halted = true;
            this.haltReason = `Max consecutive losses reached: ${this.maxConsecutiveLosses}`;
            return false;
        }
        if (this.dailyStartEquity > 0) {
            const dailyDD = ((this.dailyStartEquity - equity) / this.dailyStartEquity) * 100;
            if (dailyDD >= this.maxDailyDrawdown) {
                this.halted = true;
                this.haltReason = `Max daily drawdown reached: ${dailyDD.toFixed(2)}%`;
                return false;
            }
        }
        const totalDD = ((this.peakEquity - equity) / this.peakEquity) * 100;
        if (totalDD >= this.maxTotalDrawdown) {
            this.halted = true;
            this.haltReason = `Max total drawdown reached: ${totalDD.toFixed(2)}%`;
            return false;
        }
        return true;
    }

    recordTradeResult(trade) {
        if (trade.netPnl < 0) {
            this.consecutiveLosses++;
        } else {
            this.consecutiveLosses = 0;
        }
    }

    resetDailyGuard() {
        this.halted = false;
        this.haltReason = null;
    }
}
