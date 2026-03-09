import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

// Optional: import StrategyPresets if we want default strategies loaded into the store initially
// import { StrategyPresets } from '../strategy/StrategyPresets.js';

const useBacktestStore = create(
    persist(
        (set, get) => ({
            strategies: [],       // Saved user strategies
            activeStrategyId: null, // Strategy currently loaded in builder

            // Builder State (Draft)
            draftStrategy: null,

            // Run State
            isRunning: false,
            progress: {
                phase: '', // fetch, normalize, simulate
                percent: 0,
            },

            // Results State
            lastResult: null,

            // Actions - Strategies
            saveStrategy: (strategy) => {
                set((state) => {
                    const index = state.strategies.findIndex(s => s.id === strategy.id);
                    const newStrategies = [...state.strategies];
                    if (index >= 0) {
                        newStrategies[index] = strategy;
                    } else {
                        newStrategies.push({ ...strategy, id: strategy.id || nanoid() });
                    }
                    return { strategies: newStrategies, draftStrategy: strategy };
                });
            },
            deleteStrategy: (id) => {
                set((state) => ({
                    strategies: state.strategies.filter(s => s.id !== id),
                    activeStrategyId: state.activeStrategyId === id ? null : state.activeStrategyId,
                }));
            },
            loadStrategy: (id) => {
                const strategy = get().strategies.find(s => s.id === id);
                if (strategy) {
                    set({ activeStrategyId: id, draftStrategy: JSON.parse(JSON.stringify(strategy)) });
                }
            },
            initDraftFromPreset: (preset) => {
                set({ draftStrategy: JSON.parse(JSON.stringify({ ...preset, id: nanoid() })), activeStrategyId: null });
            },
            updateDraft: (updates) => {
                set((state) => ({
                    draftStrategy: { ...state.draftStrategy, ...updates }
                }));
            },

            // Actions - Execution
            setRunning: (isRunning) => set({ isRunning }),
            setProgress: (phase, percent) => set({ progress: { phase, percent } }),
            setResults: (result) => set({ lastResult: result }),
            clearResults: () => set({ lastResult: null })

        }),
        {
            name: 'nexus-backtest-storage',
            version: 1,
            // Do not persist run results or active run state to avoid massive cache blobs on reload
            partialize: (state) => ({
                strategies: state.strategies,
                activeStrategyId: state.activeStrategyId,
                draftStrategy: state.draftStrategy
            }),
        }
    )
);

export default useBacktestStore;
