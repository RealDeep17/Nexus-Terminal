import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useSettingsStore = create(
    persist(
        (set) => ({
            // Chart Tab
            chartType: 'Candles',
            timeframe: '15m',
            showVolume: true,
            showWatermark: true,
            crosshairMode: 'Normal',
            backgroundColor: '#131722',
            gridOpacity: 10,
            candleUpColor: '#26a69a',
            candleDownColor: '#ef5350',

            // Indicators Tab
            emaPeriods: [21, 50, 100, 200],
            rsiLevels: { overbought: 70, oversold: 30 },
            bbMultiplier: 2,
            supertrendParams: { atr: 10, multiplier: 3 },

            // Alerts Tab
            audioAlerts: true,
            browserNotifications: false,
            toastDuration: 5,
            defaultFireMode: 'Once',
            defaultCooldown: 60,

            // Watchlist Tab
            defaultSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'],
            pricePrecision: 'Auto',
            flashAnimations: true,

            // Appearance Tab
            fontSize: 'Medium',
            numberFormat: '1,234.56',
            timeFormat: 'UTC',
            sidebarWidth: 320,

            // API Tab
            binanceApiKey: '',
            binanceApiSecret: '',

            // Setters
            updateSetting: (key, value) => set({ [key]: value }),
            updateNestedSetting: (group, key, value) => set((state) => ({
                [group]: { ...state[group], [key]: value }
            })),
            updateArraySetting: (key, index, value) => set((state) => {
                const arr = [...state[key]];
                arr[index] = value;
                return { [key]: arr };
            })
        }),
        {
            name: 'nexus-settings',
        }
    )
);

export default useSettingsStore;
