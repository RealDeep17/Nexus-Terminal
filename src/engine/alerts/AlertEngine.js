// ─────────────────────────────────────────────────────────────────────────────
// AlertEngine — Background Singleton checking rules globally
// ─────────────────────────────────────────────────────────────────────────────

import { AlertEvaluator } from './AlertEvaluator.js';
import { AlertDataFeed } from './AlertDataFeed.js';
import { AlertNotifier } from './AlertNotifier.js';
import { AlertCooldown } from './AlertCooldown.js';
import useAlertStore from './useAlertStore.js';

class AlertEngineSingleton {
    constructor() {
        this.dataFeed = new AlertDataFeed();
        this.notifier = AlertNotifier;
        this.cooldown = new AlertCooldown();
        this.intervalId = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        // Fast-tick price alerts directly from WebSocket stream to catch immediate crosses/targets
        this.dataFeed.onPriceTick((symbol, price) => {
            this._evaluatePriceAlertsFast(symbol, price);
        });

        // Main evaluation loop roughly every 2 seconds
        this.intervalId = setInterval(() => this.evaluateAll(), 2000);
        console.log("🔔 Nexus AlertEngine Background Service Started");
    }

    stop() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.dataFeed.cleanup();
        this.cooldown.clearAll();
        this.isRunning = false;
        console.log("🔕 Nexus AlertEngine Stopped");
    }

    async evaluateAll() {
        const { alerts } = useAlertStore.getState();
        const activeAlerts = alerts.filter(a => a.armed && !a.paused);

        if (activeAlerts.length === 0) return;

        this.cooldown.cleanup();

        // Group alerts by symbol to fetch data once per symbol
        const bySymbol = activeAlerts.reduce((acc, alert) => {
            if (!acc[alert.symbol]) acc[alert.symbol] = [];
            acc[alert.symbol].push(alert);
            return acc;
        }, {});

        for (const [symbol, symbolAlerts] of Object.entries(bySymbol)) {
            // Determine exactly which indicators we need to compute for this symbol's alerts
            const requiredIndicators = this._extractRequiredIndicators(symbolAlerts);

            const data = await this.dataFeed.getLatestData(symbol, requiredIndicators);
            if (!data) continue;

            for (const alert of symbolAlerts) {
                // Skip purely simple price target alerts in this 2s loop 
                // because they are handled faster by the onPriceTick WS hook.
                // But evaluate everything else (EMA crosses, RSI, MACD, etc.)
                if (alert.type === 'PRICE_TARGET') continue;

                if (!this.cooldown.isOnCooldown(alert.id)) {
                    const fired = AlertEvaluator.evaluate(alert, data);
                    if (fired) {
                        this.triggerAlert(alert, data);
                    }
                }
            }
        }
    }

    _evaluatePriceAlertsFast(symbol, price) {
        const { alerts } = useAlertStore.getState();
        const priceAlerts = alerts.filter(a =>
            a.armed && !a.paused && a.symbol === symbol && a.type === 'PRICE_TARGET'
        );

        for (const alert of priceAlerts) {
            if (!this.cooldown.isOnCooldown(alert.id)) {
                // Mock data structure solely for Price Target evaluator
                const fired = AlertEvaluator.evaluate(alert, { price });
                if (fired) {
                    this.triggerAlert(alert, { price });
                }
            }
        }
    }

    triggerAlert(alert, data) {
        const { recordTrigger, disarmAlert } = useAlertStore.getState();

        // 1. Notify user (Audio, Toast, OS Notif)
        const message = `${alert.symbol} ${alert.name} triggered @ ${(data.price || 0).toFixed(2)}`;
        this.notifier.notify({ symbol: alert.symbol, message, priceAtFire: data.price, alertId: alert.id });

        // 2. Record to history in Zustand
        recordTrigger(alert.id, data, message);

        // 3. Handle Arming/Cooldown based on User settings
        if (alert.fireMode === 'once') {
            disarmAlert(alert.id);
        } else if (alert.fireMode === 'every_time') {
            this.cooldown.set(alert.id, alert.cooldownMs ?? 60000); // UI configurable cooldown
        }
        // 'always' mode implies no cooldown—it will refire every 2 seconds if still true.
    }

    _extractRequiredIndicators(alerts) {
        const reqs = new Set();
        alerts.forEach(a => {
            if (a.params.emaKey) reqs.add(a.params.emaKey);
            if (a.params.emaA) reqs.add(a.params.emaA);
            if (a.params.emaB) reqs.add(a.params.emaB);
            if (a.params.rsiKey) reqs.add(a.params.rsiKey);
            if (a.params.macdKey) reqs.add(a.params.macdKey);
            if (a.params.bbKey) reqs.add(a.params.bbKey);
            if (a.params.indicatorPath) reqs.add(a.params.indicatorPath.split('.')[0]);
        });
        return Array.from(reqs);
    }
}

// Export singleton instance 
export const AlertEngine = new AlertEngineSingleton();
