import { create } from 'zustand';

const useLayoutStore = create((set) => ({
    rightSidebarOpen: true,
    rightSidebarWidth: 320,
    leftToolbarVisible: true,
    activeRightTab: 'Watchlist',
    backtestPanelOpen: false,
    backtestPanelHeight: 300,

    settingsOpen: false,
    scannerOpen: false, // Added scannerOpen state
    marketOverviewOpen: false,

    setRightTab: (tab) => set({ activeRightTab: tab, rightSidebarOpen: true }),
    toggleRightSidebar: () => set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
    toggleBacktest: () => set((state) => ({ backtestPanelOpen: !state.backtestPanelOpen })),
    toggleBacktestPanel: () => set((state) => ({ backtestPanelOpen: !state.backtestPanelOpen })),
    toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
    setSettingsOpen: (isOpen) => set({ settingsOpen: isOpen }),
    setRightSidebarWidth: (w) => set({ rightSidebarWidth: w }),
    setBacktestHeight: (h) => set({ backtestPanelHeight: h }),
    setBacktestPanelHeight: (h) => set({ backtestPanelHeight: h }),
    toggleScanner: () => set(s => ({ scannerOpen: !s.scannerOpen })), // Added toggleScanner action
    toggleMarketOverview: () => set(s => ({ marketOverviewOpen: !s.marketOverviewOpen }))
}));

export default useLayoutStore;
