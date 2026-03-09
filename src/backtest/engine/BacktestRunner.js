// ─────────────────────────────────────────────────────────────────────────────
// BacktestRunner — Main orchestrator running the full bar-by-bar simulation
// ─────────────────────────────────────────────────────────────────────────────

import BarIterator from './BarIterator.js';
import ConditionEvaluator from './ConditionEvaluator.js';
import OrderManager from './OrderManager.js';
import PositionTracker from './PositionTracker.js';
import RiskManager from './RiskManager.js';
import EquityCurve from './EquityCurve.js';
import MetricsCalculator from './MetricsCalculator.js';
import { ConditionRegistry } from '../conditions/ConditionRegistry.js';
import { getIndicatorValue } from '../../indicators/index.js';
import { extractIndicatorConfigs } from '../../indicators/index.js';

export default class BacktestRunner {
    constructor() {
        this.onProgress = null;
    }

    run(strategy, bars, additionalTFData = {}) {
        const startTime = performance.now();
        const config = strategy.backtestConfig;
        const initialCapital = config.initialCapital || 10000;

        const indicatorConfigs = extractIndicatorConfigs(strategy);
        const iterator = new BarIterator(bars, indicatorConfigs, additionalTFData);
        const registry = new ConditionRegistry();
        const conditionEvaluator = new ConditionEvaluator(registry);
        const orderManager = new OrderManager(config);
        const positionTracker = new PositionTracker();
        const riskManager = new RiskManager(strategy.filters || {});
        const equityCurve = new EquityCurve(initialCapital);

        const startIndex = iterator.startIndex;
        const endIndex = iterator.endIndex;
        const totalBars = endIndex - startIndex + 1;

        if (totalBars <= 0) {
            return this._emptyResult(initialCapital, startTime, 0);
        }

        let equity = initialCapital;
        let realizedPnlThisBar = 0;

        for (let i = startIndex; i <= endIndex; i++) {
            realizedPnlThisBar = 0;
            const context = iterator.getContext(i, positionTracker.position, equity);

            if (this.onProgress && (i - startIndex) % 100 === 0) {
                this.onProgress({
                    phase: 'simulation',
                    current: i - startIndex,
                    total: totalBars,
                    pct: ((i - startIndex) / totalBars) * 100,
                });
            }

            const guardsOk = riskManager.checkRiskGuards(equity, context.bar);

            const fills = orderManager.processPendingOrders(
                context.bar, i,
                getIndicatorValue(iterator.indicators, 'atr_14', i)
            );

            for (const fill of fills) {
                if (fill.reason === 'entry' && positionTracker.isFlat) {
                    const slPrice = riskManager.calculateStopLossPrice(
                        fill.fillPrice,
                        fill.direction,
                        strategy.exitRule?.stopLoss,
                        getIndicatorValue(iterator.indicators, 'atr_14', i)
                    );
                    const slDist = slPrice !== null ? Math.abs(fill.fillPrice - slPrice) : 0;
                    const tpPrice = riskManager.calculateTakeProfitPrice(
                        fill.fillPrice,
                        fill.direction,
                        strategy.exitRule?.takeProfit,
                        getIndicatorValue(iterator.indicators, 'atr_14', i),
                        slDist
                    );
                    const trailPrice = riskManager.calculateTrailingStopPrice(
                        fill.fillPrice,
                        fill.direction,
                        strategy.exitRule?.stopLoss
                    );
                    const initialRisk = riskManager.calculateInitialRisk(fill.fillPrice, slPrice, fill.quantity);
                    positionTracker.openPosition(fill, {
                        stopLossPrice: slPrice,
                        takeProfitPrice: tpPrice,
                        trailingStopPrice: trailPrice,
                        initialRisk,
                    });
                    equity -= fill.commission;
                    realizedPnlThisBar -= fill.commission;
                } else if (fill.reason !== 'entry' && !positionTracker.isFlat) {
                    if (fill.partialPct < 100) {
                        const trade = positionTracker.executePartialExit(fill, fill.partialPct);
                        if (trade) {
                            trade.symbol = strategy.universe?.symbol || '';
                            riskManager.recordTradeResult(trade);
                            realizedPnlThisBar += trade.netPnl;
                        }
                    } else {
                        const trade = positionTracker.closePosition(fill);
                        if (trade) {
                            trade.symbol = strategy.universe?.symbol || '';
                            riskManager.recordTradeResult(trade);
                            realizedPnlThisBar += trade.netPnl;
                        }
                    }
                }
            }

            if (!positionTracker.isFlat) {
                positionTracker.updatePosition(context.bar);

                const slResult = positionTracker.checkStopLoss(context.bar, strategy.exitRule?.stopLoss);
                if (slResult && slResult.hit) {
                    const commission = orderManager.calculateCommission(slResult.price, positionTracker.position.remainingQuantity);
                    const trade = positionTracker.closePosition({
                        fillPrice: slResult.price,
                        time: context.bar.time,
                        barIndex: i,
                        reason: slResult.reason,
                        commission,
                        partialPct: 100,
                    });
                    if (trade) {
                        trade.symbol = strategy.universe?.symbol || '';
                        riskManager.recordTradeResult(trade);
                        realizedPnlThisBar += trade.netPnl;
                    }
                }

                if (!positionTracker.isFlat) {
                    const tpResult = positionTracker.checkTakeProfit(context.bar, strategy.exitRule?.takeProfit);
                    if (tpResult && tpResult.hit) {
                        const exitQty = tpResult.partialPct
                            ? positionTracker.position.remainingQuantity * (tpResult.partialPct / 100)
                            : positionTracker.position.remainingQuantity;
                        const commission = orderManager.calculateCommission(tpResult.price, exitQty);
                        const fill = {
                            fillPrice: tpResult.price,
                            time: context.bar.time,
                            barIndex: i,
                            reason: 'take_profit',
                            commission,
                            partialPct: tpResult.partialPct || 100,
                        };
                        if (tpResult.partialPct && tpResult.partialPct < 100) {
                            const trade = positionTracker.executePartialExit(fill, tpResult.atValue);
                            if (trade) {
                                trade.symbol = strategy.universe?.symbol || '';
                                riskManager.recordTradeResult(trade);
                                realizedPnlThisBar += trade.netPnl;
                            }
                        } else {
                            const trade = positionTracker.closePosition(fill);
                            if (trade) {
                                trade.symbol = strategy.universe?.symbol || '';
                                riskManager.recordTradeResult(trade);
                                realizedPnlThisBar += trade.netPnl;
                            }
                        }
                    }
                }

                if (!positionTracker.isFlat && strategy.exitRule?.conditions) {
                    const exitCtx = iterator.getContext(i, positionTracker.position, equity);
                    const exitSignal = conditionEvaluator.evaluate(strategy.exitRule.conditions, exitCtx);
                    if (exitSignal) {
                        orderManager.createOrder('MARKET', positionTracker.position.direction === 'long' ? 'short' : 'long',
                            positionTracker.position.remainingQuantity, context.bar.close, { reason: 'signal', createdBar: i });
                    }
                }

                if (!positionTracker.isFlat && strategy.exitRule?.timeExit?.enabled) {
                    if (positionTracker.position.barsInTrade >= strategy.exitRule.timeExit.barsInTrade) {
                        const commission = orderManager.calculateCommission(context.bar.close, positionTracker.position.remainingQuantity);
                        const trade = positionTracker.closePosition({
                            fillPrice: context.bar.close,
                            time: context.bar.time,
                            barIndex: i,
                            reason: 'time',
                            commission,
                            partialPct: 100,
                        });
                        if (trade) {
                            trade.symbol = strategy.universe?.symbol || '';
                            riskManager.recordTradeResult(trade);
                            realizedPnlThisBar += trade.netPnl;
                        }
                    }
                }
            }

            if (positionTracker.isFlat && guardsOk) {
                const directions = strategy.entryRule?.direction === 'both'
                    ? ['long', 'short'] : [strategy.entryRule?.direction || 'long'];

                for (const dir of directions) {
                    if (!positionTracker.isFlat) break;
                    const entryCtx = iterator.getContext(i, null, equity);
                    entryCtx._direction = dir;
                    const entrySignal = conditionEvaluator.evaluate(strategy.entryRule?.conditions, entryCtx);
                    if (!entrySignal) continue;
                    const filtersOk = conditionEvaluator.evaluateFilters(strategy.filters, entryCtx);
                    if (!filtersOk) continue;

                    const sizing = strategy.entryRule?.sizing || { type: 'percent_equity', value: 10 };
                    const atrVal = getIndicatorValue(iterator.indicators, 'atr_14', i);
                    const tempSL = riskManager.calculateStopLossPrice(context.bar.close, dir, strategy.exitRule?.stopLoss, atrVal);
                    const quantity = riskManager.calculatePositionSize(sizing, equity, context.bar.close, tempSL);

                    if (quantity > 0) {
                        const orderType = strategy.entryRule?.order?.type || 'market';
                        orderManager.createOrder(orderType.toUpperCase(), dir, quantity, context.bar.close, {
                            reason: 'entry',
                            createdBar: i,
                            limitOffset: strategy.entryRule?.order?.limitOffset,
                            stopOffset: strategy.entryRule?.order?.stopOffset,
                        });
                    }
                }
            }

            const unrealizedPnl = positionTracker.isFlat ? 0 : positionTracker.getUnrealizedPnl(context.bar.close);
            const eqResult = equityCurve.update(context.bar.time, realizedPnlThisBar, unrealizedPnl);
            equity = equityCurve.getCurrentEquity();
        }

        if (!positionTracker.isFlat) {
            const lastBar = bars[endIndex];
            const commission = orderManager.calculateCommission(lastBar.close, positionTracker.position.remainingQuantity);
            const trade = positionTracker.forceClose(lastBar, endIndex, commission);
            if (trade) trade.symbol = strategy.universe?.symbol || '';
        }

        const trades = positionTracker.trades;
        const ecResult = equityCurve.getResults();
        const metrics = MetricsCalculator.calculate(trades, ecResult.curve, initialCapital);
        const buyHoldCurve = equityCurve.getBuyHoldCurve(bars.slice(startIndex), initialCapital);
        const buyHoldReturn = buyHoldCurve.length > 0
            ? ((buyHoldCurve[buyHoldCurve.length - 1].equity - initialCapital) / initialCapital) * 100 : 0;

        const duration = performance.now() - startTime;

        return {
            trades,
            equityCurve: ecResult.curve,
            drawdownCurve: ecResult.drawdownCurve,
            buyHoldCurve,
            metrics,
            summary: {
                symbol: strategy.universe?.symbol || '',
                timeframe: strategy.universe?.timeframe || '',
                startDate: bars[startIndex]?.time,
                endDate: bars[endIndex]?.time,
                totalBars: totalBars,
                totalTrades: trades.length,
                netProfit: metrics.returns.netProfit,
                netProfitPct: metrics.returns.netProfitPct,
                winRate: metrics.tradeStats.winRate,
                sharpe: metrics.riskAdjusted.sharpe,
                maxDrawdown: metrics.risk.maxDrawdown,
                buyHoldReturn,
                alpha: metrics.returns.netProfitPct - buyHoldReturn,
                finalEquity: ecResult.finalEquity,
                initialCapital,
            },
            runMetadata: {
                duration,
                barsProcessed: totalBars,
                version: '1.0.0',
            },
        };
    }

    _emptyResult(initialCapital, startTime, barsProcessed) {
        return {
            trades: [],
            equityCurve: [],
            drawdownCurve: [],
            buyHoldCurve: [],
            metrics: MetricsCalculator.calculate([], [], initialCapital),
            summary: {
                totalTrades: 0,
                netProfit: 0,
                netProfitPct: 0,
                winRate: 0,
                sharpe: 0,
                maxDrawdown: 0,
                buyHoldReturn: 0,
                alpha: 0,
                finalEquity: initialCapital,
                initialCapital,
            },
            runMetadata: {
                duration: performance.now() - startTime,
                barsProcessed,
                version: '1.0.0',
            },
        };
    }
}
