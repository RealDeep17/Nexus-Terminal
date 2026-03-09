import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';

// Layout Components
import TopBar from './components/layout/TopBar.jsx';
import BottomBar from './components/layout/BottomBar.jsx';
import RightSidebar from './components/layout/RightSidebar.jsx';
import LeftToolbar from './components/layout/LeftToolbar.jsx';
import MultiChartLayout from './components/chart/MultiChartLayout.jsx';
import MarketOverviewContainer from './components/layout/MarketOverviewContainer.jsx';
import BacktestPanel from './backtest/components/BacktestPanel.jsx';

import { AlertEngine } from './engine/alerts/AlertEngine.js';
import AlertCreatorModal from './components/alerts/AlertCreatorModal.jsx';
import SettingsModal from './components/settings/SettingsModal.jsx';
import TokenScanner from './components/scanner/TokenScanner.jsx';
import AlertToast from './components/alerts/AlertToast.jsx';
import { useWatchlistLiveData } from './api/useWatchlistLiveData.js';

// Global Stores
import useLayoutStore from './store/useLayoutStore.js';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts.js';
import usePaperStore from './backtest/store/usePaperStore.js';

export default function App() {
    // 1. Initialize Singletons & Global Hooks
    useWatchlistLiveData();

    useEffect(() => {
        // Start the background evaluation engine for alerts
        AlertEngine.start();
        return () => AlertEngine.stop();
    }, []);

    // 2. Global Toast Events
    useEffect(() => {
        const handleAlertToast = (e) => {
            const triggerData = e.detail;
            toast((t) => <AlertToast alert={triggerData} t={t} />, {
                duration: 8000,
                position: 'top-right'
            });
        };

        window.addEventListener('nexus:alert-toast', handleAlertToast);
        return () => window.removeEventListener('nexus:alert-toast', handleAlertToast);
    }, []);

    // 3. Global Modal Events
    const [alertModalOpen, setAlertModalOpen] = useState(false);
    const [alertPrefilledPrice, setAlertPrefilledPrice] = useState(null);
    useEffect(() => {
        const handleOpenCreator = (e) => {
            setAlertPrefilledPrice(e.detail?.price || null);
            setAlertModalOpen(true);
        };
        window.addEventListener('nexus:open-alert-creator', handleOpenCreator);
        return () => window.removeEventListener('nexus:open-alert-creator', handleOpenCreator);
    }, []);

    // 5. Paper Trading Tick Bridge
    const tickUpdate = usePaperStore(s => s.tickUpdate);
    useEffect(() => {
        const handlePaperTick = (e) => {
            tickUpdate(e.detail);
        };
        window.addEventListener('nexus:paper-tick', handlePaperTick);
        return () => window.removeEventListener('nexus:paper-tick', handlePaperTick);
    }, [tickUpdate]);

    // 6. Open Backtest Event
    useEffect(() => {
        const handleOpenBacktest = () => {
            const store = useLayoutStore.getState();
            if (store.toggleBacktest) store.toggleBacktest();
            else store.setBacktestPanelOpen(!store.backtestPanelOpen);
        };
        window.addEventListener('nexus:open-backtest', handleOpenBacktest);
        return () => window.removeEventListener('nexus:open-backtest', handleOpenBacktest);
    }, []);

    // 4. Layout Layout state
    const {
        rightSidebarOpen, rightSidebarWidth,
        leftToolbarVisible,
        backtestPanelOpen, backtestPanelHeight,
        marketOverviewOpen
    } = useLayoutStore();

    return (
        <div className="flex flex-col h-screen w-screen bg-tv-bg text-tv-text font-sans overflow-hidden">
            <Toaster
                toastOptions={{
                    className: '',
                    style: { background: 'transparent', boxShadow: 'none', padding: 0 }
                }}
            />

            {/* Overlay Layers */}
            {alertModalOpen && <AlertCreatorModal onClose={() => { setAlertModalOpen(false); setAlertPrefilledPrice(null); }} prefilledPrice={alertPrefilledPrice} />}
            <SettingsModal />
            <TokenScanner />

            {/* Application Header Layer */}
            <TopBar />

            {/* Application Main Work Area Layer */}
            <div className="flex flex-1 overflow-hidden relative">
                {leftToolbarVisible && <LeftToolbar />}

                {/* Chart Area */}
                <div className="flex flex-col flex-1 relative min-w-0">
                    {marketOverviewOpen && <MarketOverviewContainer />}
                    <MultiChartLayout />

                    {/* Draggable Paper Trading HUD Overlay */}
                    {backtestPanelOpen && (
                        <div
                            style={{ height: backtestPanelHeight }}
                            className="border-t border-tv-border bg-tv-panel relative shrink-0"
                        >
                            <BacktestPanel />
                        </div>
                    )}
                </div>

                {rightSidebarOpen && (
                    <div style={{ width: rightSidebarWidth }} className="shrink-0 flex group">
                        <RightSidebar />
                    </div>
                )}
            </div>

            {/* Application Status Bar Layer */}
            <BottomBar />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional Error Boundary mapping here...
// ─────────────────────────────────────────────────────────────────────────────
