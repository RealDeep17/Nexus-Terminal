import { create } from 'zustand';

const useMarketStore = create((set) => ({
    prices: {}, // { symbol: { price, prevPrice, change24h, volume24h, high24h, low24h } }
    klines: {}, // { symbol_tf: Kline[] }
    tickers: {}, // 24hr stats from REST
    multiTfChanges: {}, // { symbol: { '1h': 0.5, '4h': 1.2, '1d': -2.1, '1w': 5.5 } }
    wsStatus: 'disconnected', // 'connected', 'reconnecting', 'disconnected'
    latency: 0,

    updateLatency: (ms) => set({ latency: ms }),

    updatePrice: (symbol, priceData) => set((state) => {
        const prev = state.prices[symbol]?.price || priceData.price;
        const currentHistory = state.prices[symbol]?.history || [];
        const nextHistory = [...currentHistory, priceData.price].slice(-20);

        return {
            prices: {
                ...state.prices,
                [symbol]: {
                    ...state.prices[symbol],
                    ...priceData,
                    prevPrice: prev,
                    history: nextHistory
                }
            }
        };
    }),

    setKlines: (symbol, tf, data) => set((state) => ({
        klines: {
            ...state.klines,
            [`${symbol}_${tf}`]: data
        }
    })),

    updateTicker: (symbol, apiData) => set((state) => ({
        tickers: {
            ...state.tickers,
            [symbol]: apiData
        }
    })),

    setMultiTfChange: (symbol, tfMap) => set((state) => ({
        multiTfChanges: {
            ...state.multiTfChanges,
            [symbol]: {
                ...(state.multiTfChanges[symbol] || {}),
                ...tfMap
            }
        }
    })),

    setWsStatus: (status) => set({ wsStatus: status })
}));

export default useMarketStore;
