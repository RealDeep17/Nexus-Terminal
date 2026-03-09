// ─────────────────────────────────────────────────────────────────────────────
// OrderManager — Handles order creation, queueing, and fill logic
// ─────────────────────────────────────────────────────────────────────────────

import { SlippageModel } from '../orders/SlippageModel.js';

export default class OrderManager {
    constructor(backtestConfig) {
        this.config = backtestConfig;
        this.slippageModel = new SlippageModel(
            backtestConfig.slippageType || 'none',
            backtestConfig.slippageValue || 0
        );
        this.commissionRate = backtestConfig.commissionValue || 0.04;
        this.commissionType = backtestConfig.commissionType || 'percentage';
        this.pendingOrders = [];
        this.nextOrderId = 1;
    }

    createOrder(type, direction, quantity, triggerPrice, options = {}) {
        const order = {
            id: this.nextOrderId++,
            type: type.toUpperCase(),
            direction,
            quantity,
            triggerPrice,
            limitOffset: options.limitOffset || null,
            stopOffset: options.stopOffset || null,
            status: 'pending',
            createdBar: options.createdBar || 0,
            maxBarsToFill: options.maxBarsToFill || 10,
            barsElapsed: 0,
            reason: options.reason || 'signal',
            partialPct: options.partialPct || 100,
        };
        if (order.type === 'MARKET') {
            order.status = 'ready';
        }
        this.pendingOrders.push(order);
        return order;
    }

    processPendingOrders(bar, barIndex, atrValue) {
        const fills = [];
        const remaining = [];
        for (const order of this.pendingOrders) {
            order.barsElapsed++;
            if (order.status === 'cancelled') continue;
            if (order.barsElapsed > order.maxBarsToFill && order.type !== 'MARKET') {
                order.status = 'cancelled';
                continue;
            }
            const fill = this._tryFill(order, bar, barIndex, atrValue);
            if (fill) {
                fills.push(fill);
            } else {
                remaining.push(order);
            }
        }
        this.pendingOrders = remaining;
        return fills;
    }

    _tryFill(order, bar, barIndex, atrValue) {
        const isLong = order.direction === 'long';
        switch (order.type) {
            case 'MARKET': {
                const rawPrice = bar.open;
                const fillPrice = this.slippageModel.apply(rawPrice, isLong ? 'buy' : 'sell', atrValue);
                return this._createFill(order, fillPrice, bar, barIndex);
            }
            case 'LIMIT': {
                const limitPrice = order.triggerPrice + (order.limitOffset || 0);
                if (isLong && bar.low <= limitPrice) {
                    const fillPrice = Math.min(limitPrice, bar.open);
                    return this._createFill(order, fillPrice, bar, barIndex);
                }
                if (!isLong && bar.high >= limitPrice) {
                    const fillPrice = Math.max(limitPrice, bar.open);
                    return this._createFill(order, fillPrice, bar, barIndex);
                }
                return null;
            }
            case 'STOP': {
                const stopPrice = order.triggerPrice + (order.stopOffset || 0);
                if (isLong && bar.high >= stopPrice) {
                    const triggerAt = bar.open >= stopPrice ? bar.open : stopPrice;
                    const fillPrice = this.slippageModel.apply(triggerAt, 'buy', atrValue);
                    return this._createFill(order, fillPrice, bar, barIndex);
                }
                if (!isLong && bar.low <= stopPrice) {
                    const triggerAt = bar.open <= stopPrice ? bar.open : stopPrice;
                    const fillPrice = this.slippageModel.apply(triggerAt, 'sell', atrValue);
                    return this._createFill(order, fillPrice, bar, barIndex);
                }
                return null;
            }
            case 'STOP_LIMIT': {
                const stopPrice = order.triggerPrice + (order.stopOffset || 0);
                const limitPrice = order.triggerPrice + (order.limitOffset || 0);
                let triggered = false;
                if (isLong && bar.high >= stopPrice) triggered = true;
                if (!isLong && bar.low <= stopPrice) triggered = true;
                if (triggered) {
                    if (isLong && bar.low <= limitPrice) {
                        return this._createFill(order, limitPrice, bar, barIndex);
                    }
                    if (!isLong && bar.high >= limitPrice) {
                        return this._createFill(order, limitPrice, bar, barIndex);
                    }
                    order.type = 'LIMIT';
                    order.triggerPrice = limitPrice;
                    order.limitOffset = 0;
                }
                return null;
            }
            default:
                return null;
        }
    }

    _createFill(order, fillPrice, bar, barIndex) {
        const commission = this.calculateCommission(fillPrice, order.quantity);
        order.status = 'filled';
        return {
            orderId: order.id,
            direction: order.direction,
            fillPrice,
            quantity: order.quantity,
            commission,
            time: bar.time,
            barIndex,
            reason: order.reason,
            partialPct: order.partialPct,
        };
    }

    calculateCommission(price, quantity) {
        const value = price * quantity;
        switch (this.commissionType) {
            case 'percentage':
                return value * (this.commissionRate / 100);
            case 'fixed':
                return this.commissionRate;
            case 'tiered':
                return value * (this.commissionRate / 100);
            default:
                return value * (this.commissionRate / 100);
        }
    }

    cancelAllPending() {
        this.pendingOrders = [];
    }
}
