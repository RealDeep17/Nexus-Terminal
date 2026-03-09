import { create } from 'zustand';

const useReplayStore = create((set, get) => ({
    isChoosingStartNode: false,
    isActive: false,

    // Core replay data array (static historical data)
    klines: [],

    currentIndex: 0,
    isPlaying: false,
    speed: 1000, // Speed in milliseconds (e.g. 1000 = 1x, 500 = 2x, etc)

    setIsChoosing: (val) => set({ isChoosingStartNode: val }),

    startReplay: (klines, startIndex) => set({
        isActive: true,
        isChoosingStartNode: false,
        klines: klines,
        currentIndex: startIndex,
        isPlaying: false
    }),

    stopReplay: () => set({
        isActive: false,
        klines: [],
        currentIndex: 0,
        isPlaying: false
    }),

    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

    setSpeed: (speed) => set({ speed }),

    stepBack: () => set((state) => ({
        currentIndex: Math.max(0, state.currentIndex - 1)
    })),

    stepForward: () => set((state) => {
        if (state.currentIndex < state.klines.length - 1) {
            return { currentIndex: state.currentIndex + 1 };
        }
        return { isPlaying: false }; // End of data
    })
}));

export default useReplayStore;
