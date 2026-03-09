import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

const useAlertStore = create(
    persist(
        (set, get) => ({
            alerts: [], // UNLIMITED array
            history: [], // rolling 500 entries
            notifPrefs: {
                browserEnabled: false,
                audioEnabled: true,
                audioVolume: 80,
                toastEnabled: true,
                toastDuration: 8000,
            },

            addAlert: (alertData) => {
                const id = nanoid();
                const newAlert = {
                    id,
                    name: alertData.name || `Alert ${id.slice(0, 4)}`,
                    symbol: alertData.symbol,
                    type: alertData.type,
                    params: alertData.params || {},
                    fireMode: alertData.fireMode || 'every_time', // once, every_time, always
                    cooldownMs: alertData.cooldownMs ?? 60000,
                    armed: true,
                    paused: false,
                    createdAt: new Date().toISOString(),
                    lastFiredAt: null,
                    fireCount: 0,
                    note: alertData.note || '',
                };
                set((state) => ({ alerts: [...state.alerts, newAlert] }));
                return id;
            },

            updateAlert: (id, updates) => {
                set((state) => ({
                    alerts: state.alerts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
                }));
            },

            removeAlert: (id) => {
                set((state) => ({
                    alerts: state.alerts.filter((a) => a.id !== id),
                }));
            },

            togglePause: (id) => {
                set((state) => ({
                    alerts: state.alerts.map((a) =>
                        a.id === id ? { ...a, paused: !a.paused } : a
                    ),
                }));
            },

            disarmAlert: (id) => {
                set((state) => ({
                    alerts: state.alerts.map((a) =>
                        a.id === id ? { ...a, armed: false } : a
                    ),
                }));
            },

            recordTrigger: (id, data, message) => {
                const now = new Date().toISOString();
                set((state) => {
                    const alert = state.alerts.find((a) => a.id === id);
                    if (!alert) return state;

                    const newHistoryEntry = {
                        id: nanoid(),
                        alertId: id,
                        alertName: alert.name,
                        symbol: alert.symbol,
                        firedAt: now,
                        priceAtFire: data.price,
                        message: message || `Triggered at ${now}`,
                    };

                    const newHistory = [newHistoryEntry, ...state.history].slice(0, 500);
                    const newAlerts = state.alerts.map((a) =>
                        a.id === id
                            ? { ...a, lastFiredAt: now, fireCount: a.fireCount + 1 }
                            : a
                    );

                    return { alerts: newAlerts, history: newHistory };
                });
            },

            clearHistory: () => set({ history: [] }),

            updatePrefs: (newPrefs) => {
                set((state) => ({ notifPrefs: { ...state.notifPrefs, ...newPrefs } }));
            },
        }),
        {
            name: 'nexus-alerts-storage',
            version: 1,
        }
    )
);

export default useAlertStore;
