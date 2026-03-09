import { create } from 'zustand';

const useMultiChartStore = create((set) => ({
    layoutId: '1', // '1', '2v', '2h', '4'
    focusedTarget: 'main', // 'main', 'chart2', 'chart3', 'chart4'

    charts: {
        main: { symbol: 'BTCUSDT', timeframe: '1h' },
        chart2: { symbol: 'ETHUSDT', timeframe: '1h' },
        chart3: { symbol: 'SOLUSDT', timeframe: '1h' },
        chart4: { symbol: 'XRPUSDT', timeframe: '1h' },
    },

    setLayout: (id) => set({ layoutId: id, focusedTarget: 'main' }),
    setFocus: (id) => set({ focusedTarget: id }),

    updateChart: (id, updates) => set(state => ({
        charts: {
            ...state.charts,
            [id]: { ...state.charts[id], ...updates }
        }
    }))
}));

export default useMultiChartStore;
