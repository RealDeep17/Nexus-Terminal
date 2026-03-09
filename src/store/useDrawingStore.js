import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

const useDrawingStore = create(
    persist(
        (set, get) => ({
            drawings: [], // { id, symbol, timeframe, type, points: [{time, price}], styles: {} }
            activeDrawingId: null,

            addDrawing: (drawing) => set((state) => ({
                drawings: [...state.drawings, { ...drawing, id: nanoid() }],
            })),

            updateDrawing: (id, updates) => set((state) => ({
                drawings: state.drawings.map(d => d.id === id ? { ...d, ...updates } : d)
            })),

            removeDrawing: (id) => set((state) => ({
                drawings: state.drawings.filter(d => d.id !== id),
                activeDrawingId: state.activeDrawingId === id ? null : state.activeDrawingId
            })),

            clearDrawingsForSymbol: (symbol) => set((state) => ({
                drawings: state.drawings.filter(d => d.symbol !== symbol)
            })),

            clearAllDrawings: () => set({ drawings: [], activeDrawingId: null }),

            setActiveDrawing: (id) => set({ activeDrawingId: id }),

            // Helper to get active drawings for current chart context
            getDrawingsForContext: (symbol) => {
                return get().drawings.filter(d => d.symbol === symbol);
            }
        }),
        {
            name: 'nexus-drawings',
            version: 1,
        }
    )
);

export default useDrawingStore;
