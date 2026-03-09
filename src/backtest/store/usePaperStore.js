import { create } from 'zustand';
import PaperTrader from '../engine/PaperTrader.js';

const usePaperStore = create((set, get) => ({
    isActive: false,
    equity: 10000,
    initialCapital: 10000,
    position: null,
    trades: [],
    equityCurve: [],
    pnl: 0,
    pnlPct: 0,
    traderRef: null,

    startPaper: (strategy, symbol, tf, capital) => {
        const trader = new PaperTrader(strategy, symbol, capital);
        trader.onUpdate((state) => {
            set({
                equity: state.equity,
                position: state.position,
                trades: state.trades,
                equityCurve: state.equityCurve,
                pnl: state.pnl,
                pnlPct: state.pnlPct
            });
        });
        trader.start();
        set({
            isActive: true,
            initialCapital: capital,
            equity: capital,
            position: null,
            trades: [],
            equityCurve: [{ time: Date.now() / 1000, equity: capital }],
            pnl: 0,
            pnlPct: 0,
            traderRef: trader
        });
    },

    stopPaper: () => {
        const { traderRef } = get();
        if (traderRef) traderRef.stop();
        set({ isActive: false, traderRef: null });
    },

    tickUpdate: (kline) => {
        const { traderRef, isActive } = get();
        if (isActive && traderRef) {
            traderRef.tick(kline);
        }
    },

    executeManualOrder: (dir, qty) => {
        const { traderRef, isActive } = get();
        if (!isActive || !traderRef) return;
        import('../../store/useMarketStore.js').then(module => {
            const currentPrice = module.default.getState().prices[traderRef.symbol]?.price;
            if (currentPrice) traderRef.executeManualOrder(dir, qty, currentPrice);
        });
    },

    closePosition: () => {
        const { traderRef, isActive } = get();
        if (!isActive || !traderRef) return;
        import('../../store/useMarketStore.js').then(module => {
            const currentPrice = module.default.getState().prices[traderRef.symbol]?.price;
            if (currentPrice) traderRef.closePosition(currentPrice);
        });
    }
}));

export default usePaperStore;
