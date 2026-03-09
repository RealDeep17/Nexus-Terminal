// ─────────────────────────────────────────────────────────────────────────────
// PositionTracker — Tracks open positions, PnL, exposure, partial exits
// ─────────────────────────────────────────────────────────────────────────────

export default class PositionTracker {
    constructor() {
        this.position = null;
        this.trades = [];
        this.nextTradeId = 1;
    }

    get isFlat() {
        return this.position === null;
    }

    get isLong() {
        return this.position !== null && this.position.direction === 'long';
    }

    get isShort() {
        return this.position !== null && this.position.direction === 'short';
    }

    openPosition(fill, sizing, entryConditions = []) {
        this.position = {
            id: this.nextTradeId++,
            direction: fill.direction,
            entryPrice: fill.fillPrice,
            entryFill: fill.fillPrice,
            entryTime: fill.time,
            entryBarIndex: fill.barIndex,
            quantity: fill.quantity,
            remainingQuantity: fill.quantity,
            entryValue: fill.fillPrice * fill.quantity,
            entryCommission: fill.commission,
            totalCommission: fill.commission,
            initialRisk: sizing.initialRisk || 0,
            stopLossPrice: sizing.stopLossPrice || null,
            takeProfitPrice: sizing.takeProfitPrice || null,
            trailingStopPrice: sizing.trailingStopPrice || null,
            highwaterPrice: fill.fillPrice,
            lowwaterPrice: fill.fillPrice,
            barsInTrade: 0,
            mfe: 0,
            mae: 0,
            mfePct: 0,
            maePct: 0,
            partialExits: [],
            entryReason: entryConditions,
        };
        return this.position;
    }

    updatePosition(bar) {
        if (!this.position) return;
        this.position.barsInTrade++;
        const p = this.position;
        if (p.direction === 'long') {
            p.highwaterPrice = Math.max(p.highwaterPrice, bar.high);
            p.lowwaterPrice = Math.min(p.lowwaterPrice, bar.low);
            const bestPnl = (bar.high - p.entryPrice) / p.entryPrice * 100;
            const worstPnl = (bar.low - p.entryPrice) / p.entryPrice * 100;
            if (bestPnl > p.mfePct) {
                p.mfePct = bestPnl;
                p.mfe = (bar.high - p.entryPrice) * p.remainingQuantity;
            }
            if (worstPnl < p.maePct) {
                p.maePct = worstPnl;
                p.mae = (bar.low - p.entryPrice) * p.remainingQuantity;
            }
        } else {
            p.highwaterPrice = Math.max(p.highwaterPrice, bar.high);
            p.lowwaterPrice = Math.min(p.lowwaterPrice, bar.low);
            const bestPnl = (p.entryPrice - bar.low) / p.entryPrice * 100;
            const worstPnl = (p.entryPrice - bar.high) / p.entryPrice * 100;
            if (bestPnl > p.mfePct) {
                p.mfePct = bestPnl;
                p.mfe = (p.entryPrice - bar.low) * p.remainingQuantity;
            }
            if (worstPnl < p.maePct) {
                p.maePct = worstPnl;
                p.mae = (p.entryPrice - bar.high) * p.remainingQuantity;
            }
        }
    }

    checkStopLoss(bar, trailingConfig = null) {
        if (!this.position) return null;
        const p = this.position;
        if (trailingConfig && trailingConfig.enabled && p.trailingStopPrice !== null) {
            if (p.direction === 'long') {
                if (trailingConfig.trailingType === 'percent') {
                    const newSL = p.highwaterPrice * (1 - trailingConfig.trailingValue / 100);
                    p.trailingStopPrice = Math.max(p.trailingStopPrice, newSL);
                }
                if (bar.low <= p.trailingStopPrice) {
                    const exitPrice = Math.min(bar.open, p.trailingStopPrice);
                    return { hit: true, price: exitPrice, reason: 'trailing_stop' };
                }
            } else {
                if (trailingConfig.trailingType === 'percent') {
                    const newSL = p.lowwaterPrice * (1 + trailingConfig.trailingValue / 100);
                    p.trailingStopPrice = Math.min(p.trailingStopPrice, newSL);
                }
                if (bar.high >= p.trailingStopPrice) {
                    const exitPrice = Math.max(bar.open, p.trailingStopPrice);
                    return { hit: true, price: exitPrice, reason: 'trailing_stop' };
                }
            }
        }
        if (p.stopLossPrice !== null) {
            if (p.direction === 'long' && bar.low <= p.stopLossPrice) {
                const exitPrice = bar.open <= p.stopLossPrice ? bar.open : p.stopLossPrice;
                return { hit: true, price: exitPrice, reason: 'stop_loss' };
            }
            if (p.direction === 'short' && bar.high >= p.stopLossPrice) {
                const exitPrice = bar.open >= p.stopLossPrice ? bar.open : p.stopLossPrice;
                return { hit: true, price: exitPrice, reason: 'stop_loss' };
            }
        }
        return null;
    }

    checkTakeProfit(bar, takeProfitConfig = null) {
        if (!this.position || !takeProfitConfig || !takeProfitConfig.enabled) return null;
        const p = this.position;
        if (takeProfitConfig.partialExits && takeProfitConfig.partialExits.length > 0) {
            for (const partial of takeProfitConfig.partialExits) {
                const alreadyExited = p.partialExits.some(
                    (pe) => pe.atValue === partial.atValue
                );
                if (alreadyExited) continue;
                let tpPrice;
                if (takeProfitConfig.type === 'percent') {
                    tpPrice = p.direction === 'long'
                        ? p.entryPrice * (1 + partial.atValue / 100)
                        : p.entryPrice * (1 - partial.atValue / 100);
                } else {
                    tpPrice = p.direction === 'long'
                        ? p.entryPrice + partial.atValue
                        : p.entryPrice - partial.atValue;
                }
                const hit = p.direction === 'long' ? bar.high >= tpPrice : bar.low <= tpPrice;
                if (hit) {
                    return {
                        hit: true,
                        price: tpPrice,
                        reason: 'take_profit',
                        partialPct: partial.percent,
                        atValue: partial.atValue,
                    };
                }
            }
            return null;
        }
        if (p.takeProfitPrice !== null) {
            if (p.direction === 'long' && bar.high >= p.takeProfitPrice) {
                const exitPrice = bar.open >= p.takeProfitPrice ? bar.open : p.takeProfitPrice;
                return { hit: true, price: exitPrice, reason: 'take_profit' };
            }
            if (p.direction === 'short' && bar.low <= p.takeProfitPrice) {
                const exitPrice = bar.open <= p.takeProfitPrice ? bar.open : p.takeProfitPrice;
                return { hit: true, price: exitPrice, reason: 'take_profit' };
            }
        }
        return null;
    }

    executePartialExit(fill, atValue) {
        if (!this.position) return null;
        const p = this.position;
        const exitQty = p.remainingQuantity * (fill.partialPct / 100);
        const grossPnl = p.direction === 'long'
            ? (fill.fillPrice - p.entryPrice) * exitQty
            : (p.entryPrice - fill.fillPrice) * exitQty;
        const netPnl = grossPnl - fill.commission;
        p.partialExits.push({
            atValue,
            exitPrice: fill.fillPrice,
            quantity: exitQty,
            grossPnl,
            netPnl,
            commission: fill.commission,
            time: fill.time,
        });
        p.remainingQuantity -= exitQty;
        p.totalCommission += fill.commission;
        if (p.remainingQuantity <= 0.000001) {
            return this._closePosition(fill);
        }
        return null;
    }

    closePosition(fill) {
        return this._closePosition(fill);
    }

    _closePosition(fill) {
        if (!this.position) return null;
        const p = this.position;
        const exitQty = p.remainingQuantity;
        p.totalCommission += fill.commission;
        let totalGrossPnl = 0;
        for (const pe of p.partialExits) {
            totalGrossPnl += pe.grossPnl;
        }
        const finalGrossPnl = p.direction === 'long'
            ? (fill.fillPrice - p.entryPrice) * exitQty
            : (p.entryPrice - fill.fillPrice) * exitQty;
        totalGrossPnl += finalGrossPnl;
        const netPnl = totalGrossPnl - p.totalCommission;
        const netPnlPct = (netPnl / p.entryValue) * 100;
        const rMultiple = p.initialRisk > 0 ? netPnl / p.initialRisk : 0;

        const trade = {
            id: p.id,
            symbol: '',
            direction: p.direction,
            entryTime: p.entryTime,
            exitTime: fill.time,
            entryBarIndex: p.entryBarIndex,
            exitBarIndex: fill.barIndex,
            barsInTrade: p.barsInTrade,
            entryPrice: p.entryPrice,
            entryFill: p.entryFill,
            exitPrice: fill.fillPrice,
            exitFill: fill.fillPrice,
            quantity: p.quantity,
            entryValue: p.entryValue,
            exitValue: fill.fillPrice * exitQty,
            grossPnl: totalGrossPnl,
            commission: p.totalCommission,
            netPnl,
            netPnlPct,
            rMultiple,
            entryReason: p.entryReason,
            exitReason: fill.reason,
            mfe: p.mfe,
            mae: p.mae,
            mfePct: p.mfePct,
            maePct: p.maePct,
            partialExits: p.partialExits,
        };
        this.trades.push(trade);
        this.position = null;
        return trade;
    }

    forceClose(bar, barIndex, commission = 0) {
        if (!this.position) return null;
        const fill = {
            fillPrice: bar.close,
            time: bar.time,
            barIndex,
            reason: 'force_close',
            commission,
            partialPct: 100,
        };
        return this._closePosition(fill);
    }

    getUnrealizedPnl(currentPrice) {
        if (!this.position) return 0;
        const p = this.position;
        if (p.direction === 'long') {
            return (currentPrice - p.entryPrice) * p.remainingQuantity;
        }
        return (p.entryPrice - currentPrice) * p.remainingQuantity;
    }

    getUnrealizedPnlPct(currentPrice) {
        if (!this.position) return 0;
        const pnl = this.getUnrealizedPnl(currentPrice);
        return (pnl / this.position.entryValue) * 100;
    }
}
