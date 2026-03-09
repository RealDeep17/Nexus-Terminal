import React, { useState, useEffect } from 'react';
import useChartStore from '../../store/useChartStore.js';
import useWatchlistStore from '../../store/useWatchlistStore.js';
import useLayoutStore from '../../store/useLayoutStore.js';
import useAlertStore from '../../engine/alerts/useAlertStore.js';
import useReplayStore from '../../store/useReplayStore.js';
import useMultiChartStore from '../../store/useMultiChartStore.js';
import { Icons } from './Icons.jsx';
import SymbolSearch from './SymbolSearch.jsx';
import useMarketStore from '../../store/useMarketStore.js';

import usePaperStore from '../../backtest/store/usePaperStore.js';
import { StrategyPresets } from '../../backtest/strategy/StrategyPresets.js';

export default function TopBar() {
    const { activeSymbol: legacySymbol, setSymbol, timeframe: legacyTf, setTimeframe, chartType, setChartType } = useChartStore();

    const layoutId = useMultiChartStore(s => s.layoutId);
    const focusedTarget = useMultiChartStore(s => s.focusedTarget);
    const multiProps = useMultiChartStore(s => s.charts[focusedTarget]) || {};

    const activeSymbol = layoutId !== '1' ? (multiProps.symbol || legacySymbol) : legacySymbol;
    const timeframe = layoutId !== '1' ? (multiProps.timeframe || legacyTf) : legacyTf;

    const priceData = useMarketStore(s => s.prices[activeSymbol]);
    const p = priceData?.price ? priceData.price.toFixed(activeSymbol?.includes('SHIB') || activeSymbol?.includes('PEPE') ? 6 : 2) : '—';
    const c = priceData?.change24h;
    const isUp = c >= 0;

    const { setRightTab } = useLayoutStore();
    const alertCount = useAlertStore(s => (s.alerts || []).filter(a => a.armed && !a.paused).length);
    const { isChoosingStartNode, isActive: replayActive, setIsChoosing, stopReplay } = useReplayStore();

    const [symbolSearchOpen, setSymbolSearchOpen] = useState(false);
    const [tfDropdownOpen, setTfDropdownOpen] = useState(false);

    useEffect(() => {
        const handleOpenSearch = () => setSymbolSearchOpen(true);
        window.addEventListener('nexus:open-symbol-search', handleOpenSearch);
        return () => window.removeEventListener('nexus:open-symbol-search', handleOpenSearch);
    }, []);

    return (
        <div className="h-[46px] bg-tv-panel border-b border-tv-border flex items-center px-1 select-none shrink-0 topbar-container">
            {/* Symbol Button */}
            <div className="relative flex items-center pr-2">
                <button
                    className="h-9 px-3 hover:bg-tv-hover rounded flex items-center gap-2 text-sm font-bold text-gray-200"
                    onClick={() => setSymbolSearchOpen(true)}
                >
                    <span className="w-6 h-6 rounded-full bg-tv-blue/20 text-tv-blue flex items-center justify-center text-xs">₿</span>
                    {activeSymbol}
                </button>
                <div className="flex flex-col justify-center leading-none tracking-tight">
                    <span className={`text-[13px] font-mono font-bold ${c !== undefined ? (isUp ? 'text-tv-green' : 'text-tv-red') : 'text-gray-400'}`}>{p}</span>
                    {c !== undefined && (
                        <span className={`text-[9px] font-mono font-semibold ${isUp ? 'text-tv-green' : 'text-tv-red'} opacity-90`}>{isUp ? '+' : ''}{c.toFixed(2)}%</span>
                    )}
                </div>
            </div>

            <SymbolSearch isOpen={symbolSearchOpen} onClose={() => setSymbolSearchOpen(false)} />

            <div className="w-[1px] h-5 bg-tv-border mx-2" />

            {/* Timeframe Quick Select */}
            <div className="flex items-center gap-0.5">
                <button
                    onClick={() => setChartType(chartType === 'heikin_ashi' ? 'candlestick' : 'heikin_ashi')}
                    className={`mr-2 flex items-center justify-center w-7 h-7 rounded transition-colors ${chartType === 'heikin_ashi' ? 'bg-tv-blue/20 text-tv-blue' : 'text-gray-400 hover:text-gray-200 hover:bg-tv-hover'}`}
                    title="Heikin Ashi"
                >
                    <span className="text-[10px] font-bold leading-none origin-bottom scale-y-110">HA</span>
                </button>

                {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
                    <button
                        key={tf}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${timeframe === tf ? 'text-tv-blue bg-tv-blue/10' : 'text-gray-300 hover:bg-tv-hover hover:text-gray-100'
                            }`}
                        onClick={() => setTimeframe(tf)}
                    >
                        {tf}
                    </button>
                ))}

                <div className="relative ml-0.5">
                    <button
                        className="px-1.5 py-1 flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-tv-hover rounded transition-colors"
                        onClick={() => setTfDropdownOpen(!tfDropdownOpen)}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                    </button>

                    {tfDropdownOpen && (
                        <div className="absolute top-8 left-0 w-16 bg-tv-bg border border-tv-border rounded shadow-xl z-50 py-1">
                            {['3m', '30m', '2h', '6h', '12h', '1w', '1M'].map(tf => (
                                <button
                                    key={tf}
                                    className={`w-full text-center px-2 py-1.5 hover:bg-tv-hover text-xs ${timeframe === tf ? 'text-tv-blue font-bold' : 'text-gray-300'
                                        }`}
                                    onClick={() => { setTimeframe(tf); setTfDropdownOpen(false); }}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="w-[1px] h-5 bg-tv-border mx-2" />

            <button
                className="h-9 px-3 hover:bg-tv-hover rounded text-sm text-gray-300 font-medium flex items-center gap-2"
                onClick={() => setRightTab('Indicators')}
                title="Indicators (Alt+I)"
            >
                <Icons.Indicators /> Indicators
            </button>

            <div className="w-[1px] h-5 bg-tv-border mx-2" />

            {/* Center Group (Chart Types etc - Hidden on small normally, but we keep flex) */}
            <div className="flex items-center space-x-1 flex-1">
                <IconButton icon={<Icons.Candles />} active={chartType === 'candlestick'} tooltip="Candlestick" onClick={() => setChartType('candlestick')} />
                <IconButton icon={<Icons.Line />} active={chartType === 'line'} tooltip="Line" onClick={() => setChartType('line')} />
                <IconButton icon={<Icons.Area />} active={chartType === 'area'} tooltip="Area" onClick={() => setChartType('area')} />

                <button
                    onClick={() => useLayoutStore.getState().toggleScanner()}
                    className="ml-4 flex items-center gap-1.5 px-3 py-1 bg-tv-blue/10 border border-tv-blue/20 hover:bg-tv-blue/20 text-tv-blue text-xs font-bold tracking-wider rounded transition-colors"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                    SCANNER
                </button>

                <button
                    onClick={() => {
                        if (replayActive) stopReplay();
                        else setIsChoosing(!isChoosingStartNode);
                    }}
                    className={`ml-2 flex items-center gap-1.5 px-3 py-1 text-xs font-bold tracking-wider rounded transition-colors ${replayActive || isChoosingStartNode
                        ? 'bg-tv-blue text-white'
                        : 'bg-tv-blue/10 border border-tv-blue/20 text-tv-blue hover:bg-tv-blue/20'
                        }`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 21L3 13L11 5" /><path d="M21 21L13 13L21 5" /></svg>
                    REPLAY
                </button>

                <span className="text-xs text-gray-500 ml-4 hidden lg:inline-block border border-tv-border px-2 py-1 rounded">Cmd+K Search</span>
            </div>

            {/* Right Group */}
            <div className="flex items-center gap-1 pr-2">
                <div className="flex items-center gap-1 mr-2 border-r border-tv-border pr-2">
                    <IconButton
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v4H4zm0 8h16v4H4z" /></svg>}
                        active={useLayoutStore(s => s.marketOverviewOpen)}
                        tooltip="Toggle Market Overview"
                        onClick={() => useLayoutStore.getState().toggleMarketOverview()}
                    />
                    <IconButton
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>}
                        active={layoutId === '1'}
                        tooltip="Single Chart"
                        onClick={() => useMultiChartStore.getState().setLayout('1')}
                    />
                    <IconButton
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="18" rx="1" /><rect x="13" y="3" width="8" height="18" rx="1" /></svg>}
                        active={layoutId === '2h'}
                        tooltip="2 Charts (Horz)"
                        onClick={() => useMultiChartStore.getState().setLayout('2h')}
                    />
                    <IconButton
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="8" rx="1" /><rect x="3" y="13" width="18" height="8" rx="1" /></svg>}
                        active={layoutId === '2v'}
                        tooltip="2 Charts (Vert)"
                        onClick={() => useMultiChartStore.getState().setLayout('2v')}
                    />
                    <IconButton
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>}
                        active={layoutId === '4'}
                        tooltip="4 Charts Grid"
                        onClick={() => useMultiChartStore.getState().setLayout('4')}
                    />
                </div>
                <button
                    className="relative w-9 h-9 flex items-center justify-center hover:bg-tv-hover rounded text-gray-400 hover:text-gray-200 transition-colors"
                    onClick={() => setRightTab('Alerts')}
                    title="Alerts Manager (Alt+A)"
                >
                    <Icons.Bell />
                    {alertCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-tv-red rounded-full flex items-center justify-center text-[8px] text-white border-2 border-tv-panel">
                            {alertCount}
                        </span>
                    )}
                </button>
                <IconButton
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /><line x1="18" y1="3" x2="24" y2="3" /><line x1="21" y1="0" x2="21" y2="6" /></svg>}
                    tooltip="Create Alert"
                    onClick={() => window.dispatchEvent(new CustomEvent('nexus:open-alert-creator'))}
                />
                <IconButton
                    icon={<Icons.Settings />}
                    tooltip="Chart Properties"
                    onClick={() => useLayoutStore.getState().toggleSettings()}
                />
                <IconButton icon={<Icons.Fullscreen />} tooltip="Fullscreen" />
            </div>

            {/* Backdrop for dropdowns */}
            {tfDropdownOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setTfDropdownOpen(false)} />
            )}
        </div>
    );
}

function IconButton({ icon, active, tooltip, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${active ? 'text-tv-blue bg-tv-blue/10' : 'text-gray-400 hover:bg-tv-hover hover:text-gray-200'}`}
            title={tooltip}
        >
            {icon}
        </button>
    );
}
