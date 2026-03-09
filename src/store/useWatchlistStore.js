import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useWatchlistStore = create(
    persist(
        (set) => ({
            symbols: [
                'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT',
                'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT'
            ],

            addSymbol: (symbol) => set((state) => {
                const s = symbol.toUpperCase();
                if (state.symbols.includes(s)) return state;
                return { symbols: [...state.symbols, s] };
            }),

            removeSymbol: (symbol) => set((state) => ({
                symbols: state.symbols.filter(s => s !== symbol)
            })),

            reorderSymbol: (startIndex, endIndex) => set((state) => {
                const result = Array.from(state.symbols);
                const [removed] = result.splice(startIndex, 1);
                result.splice(endIndex, 0, removed);
                return { symbols: result };
            })
        }),
        {
            name: 'nexus-watchlist',
            version: 1
        }
    )
);

export default useWatchlistStore;
