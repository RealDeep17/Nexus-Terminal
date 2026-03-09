import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const generateId = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);

const useJournalStore = create(
    persist(
        (set) => ({
            entries: [],
            addEntry: (entry) => set(s => ({ entries: [{ ...entry, id: entry.id || generateId(), createdAt: Date.now() }, ...s.entries].slice(0, 1000) })),
            updateEntry: (id, updates) => set(s => ({ entries: s.entries.map(e => e.id === id ? { ...e, ...updates } : e) })),
            deleteEntry: (id) => set(s => ({ entries: s.entries.filter(e => e.id !== id) })),
            clearEntries: () => set({ entries: [] }),
            importFromBacktest: (trades) => set(s => ({
                entries: [
                    ...trades.map(t => ({
                        id: generateId(), createdAt: Date.now(),
                        symbol: t.symbol, direction: t.dir,
                        entryPrice: t.entryPrice, exitPrice: t.exitPrice,
                        qty: t.qty, entryTime: t.entryTime, exitTime: t.exitTime,
                        pnl: t.pnl, pnlPct: t.pnlPct, fees: t.commission || 0,
                        tags: [], notes: '', rating: 0
                    })),
                    ...s.entries
                ].slice(0, 1000)
            }))
        }),
        { name: 'nexus-journal' }
    )
);

export default useJournalStore;
