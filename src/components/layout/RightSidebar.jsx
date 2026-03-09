import React, { useState, useEffect, useRef } from 'react';
import useLayoutStore from '../../store/useLayoutStore.js';
import useWatchlistStore from '../../store/useWatchlistStore.js';
import useMarketStore from '../../store/useMarketStore.js';
import useChartStore from '../../store/useChartStore.js';
import useAlertStore from '../../engine/alerts/useAlertStore.js';
import useJournalStore from '../../store/useJournalStore.js';
import { fetchPremiumIndex, fetchOpenInterest, fetchLongShortRatio, fetchKlines, fetchDepth } from '../../api/binance.js';

const TABS = ['Watchlist', 'Indicators', 'Alerts', 'Data', 'Journal'];

export default function RightSidebar() {
    const { rightSidebarOpen, activeRightTab, setRightTab } = useLayoutStore();

    useEffect(() => {
        const handleOpenIndicators = () => {
            if (!rightSidebarOpen) useLayoutStore.getState().toggleRightSidebar();
            setRightTab('Indicators');
        };
        window.addEventListener('nexus:open-indicators', handleOpenIndicators);
        return () => window.removeEventListener('nexus:open-indicators', handleOpenIndicators);
    }, [rightSidebarOpen, setRightTab]);

    if (!rightSidebarOpen) return null;

    return (
        <div className="w-[320px] bg-tv-panel border-l border-tv-border flex flex-col shrink-0">
            {/* Header Tabs */}
            <div className="flex border-b border-tv-border shrink-0">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setRightTab(tab)}
                        className={`flex-1 py-3 text-xs font-semibold ${activeRightTab === tab
                            ? 'text-tv-blue border-b-2 border-tv-blue bg-tv-hover/20'
                            : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col">
                {activeRightTab === 'Watchlist' && <WatchlistTab />}
                {activeRightTab === 'Indicators' && <IndicatorsTab />}
                {activeRightTab === 'Alerts' && <AlertsTab />}
                {activeRightTab === 'Data' && <DataTab />}
                {activeRightTab === 'Journal' && <JournalTab />}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade Journal Tab (Analytics & History)
// ─────────────────────────────────────────────────────────────────────────────
function JournalTab() {
    const entries = useJournalStore(s => s.entries);
    const clearEntries = useJournalStore(s => s.clearEntries);

    // Compute stats
    const totalTrades = entries.length;
    const wins = entries.filter(t => t.pnl > 0).length;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
    const totalPnl = entries.reduce((sum, t) => sum + t.pnl, 0);
    const bestTrade = entries.length > 0 ? Math.max(...entries.map(t => t.pnl)) : 0;

    const exportCSV = () => {
        if (entries.length === 0) return;
        const headers = ['Date', 'Symbol', 'Side', 'Entry', 'Exit', 'Qty', 'PnL ($)', 'PnL (%)', 'Duration (m)'];
        const rows = entries.map(t => {
            const date = new Date(t.exitTime).toLocaleString();
            const symbol = t.symbol;
            const side = t.direction ? t.direction.toUpperCase() : 'N/A';
            const entry = t.entryPrice ? t.entryPrice.toFixed(4) : '0';
            const exit = t.exitPrice ? t.exitPrice.toFixed(4) : '0';
            const qty = t.qty ? t.qty.toFixed(4) : '0';
            const pnl = t.pnl ? t.pnl.toFixed(2) : '0';
            const pnlPct = t.pnlPct ? t.pnlPct.toFixed(2) : '0';
            const duration = (t.exitTime && t.entryTime) ? ((t.exitTime - t.entryTime) / 60000).toFixed(1) : '0';
            return [date, symbol, side, entry, exit, qty, pnl, pnlPct, duration].map(v => `"${v}"`).join(',');
        });
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nexus_journal_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full bg-tv-panel relative text-tv-text">
            {/* Toolbar */}
            <div className="p-3 border-b border-tv-border flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Trade Journal</span>
                <div className="flex gap-2">
                    <button onClick={exportCSV} className="text-[10px] text-tv-blue hover:bg-tv-blue/10 px-2 py-1 rounded transition-colors border border-tv-blue/30 flex items-center gap-1" title="Export to CSV">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                        CSV
                    </button>
                    <button onClick={clearEntries} className="text-[10px] text-gray-500 hover:text-tv-red px-2 py-1 rounded bg-tv-bg transition-colors border border-tv-border">Clear</button>
                </div>
            </div>

            {/* Stats Area */}
            <div className="grid grid-cols-3 gap-2 p-3 border-b border-tv-border bg-tv-bg shrink-0 text-center">
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Win Rate</span>
                    <span className={`text-[13px] font-bold ${winRate > 50 ? 'text-tv-green' : winRate > 0 ? 'text-amber-500' : 'text-gray-400'}`}>{winRate}%</span>
                </div>
                <div className="flex flex-col border-l border-r border-tv-border">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Net PnL</span>
                    <span className={`text-[13px] font-bold tabular-nums ${totalPnl >= 0 ? 'text-tv-green' : 'text-tv-red'}`}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Best Trade</span>
                    <span className="text-[13px] font-bold text-tv-green tabular-nums">${bestTrade.toFixed(2)}</span>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                {entries.length === 0 ? (
                    <div className="text-center text-xs text-gray-500 mt-10 p-4">
                        <div className="mb-2 opacity-50">📋</div>
                        No executed trades yet.<br />Activate paper trading to log trades here.
                    </div>
                ) : (
                    entries.map(t => {
                        const isWin = t.pnl >= 0;
                        return (
                            <div key={t.id} className="p-3 border-b border-tv-border hover:bg-tv-hover transition-colors flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${t.direction === 'long' ? 'text-tv-green bg-tv-green/10' : 'text-tv-red bg-tv-red/10'}`}>{t.direction}</span>
                                        <span className="text-[13px] font-bold text-gray-200">{t.symbol}</span>
                                    </div>
                                    <span className={`text-[13px] font-bold tabular-nums ${isWin ? 'text-tv-green' : 'text-tv-red'}`}>
                                        {isWin ? '+' : ''}${t.pnl?.toFixed(2) || '0.00'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[11px] text-gray-400 font-mono">
                                    <span>{t.entryPrice?.toFixed(4)} ➔ {t.exitPrice?.toFixed(4) || '—'}</span>
                                    <span>{t.exitTime ? new Date(t.exitTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Open'}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-500">
                                    <span>Qty: {t.qty?.toFixed(4)}</span>
                                    <span>{isWin ? '+' : ''}{t.pnlPct?.toFixed(2) || '0'}%</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Watchlist Tab (Live Prices)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS = {
    price: true,
    change: false,
    changePercent: true,
    volume: false,
    tf1h: false,
    tf4h: false,
    tf1d: false,
    tf1w: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Add Symbol Picker (Inline Binance Futures Search)
// ─────────────────────────────────────────────────────────────────────────────
function AddSymbolPicker({ onClose }) {
    const [search, setSearch] = useState('');
    const [matches, setMatches] = useState([]);
    const symbols = useWatchlistStore(s => s.symbols);
    const addSymbol = useWatchlistStore(s => s.addSymbol);
    const prices = useMarketStore(s => s.prices);

    useEffect(() => {
        let active = true;
        if (!search.trim()) { setMatches([]); return; }

        import('../../api/binance.js').then(({ fetchExchangeInfo }) => {
            fetchExchangeInfo().then(info => {
                if (!active) return;
                const q = search.toUpperCase();
                const filtered = info.filter(s => s.symbol.includes(q)).slice(0, 10);
                setMatches(filtered);
            });
        });
        return () => { active = false; };
    }, [search]);

    const handleAdd = (sym) => {
        if (symbols.includes(sym)) return;
        addSymbol(sym);
        setSearch('');
    };

    return (
        <div className="absolute top-12 left-0 right-0 z-50 bg-tv-bg border-b border-tv-border shadow-2xl px-2 py-2 flex flex-col gap-2 mx-2 rounded">
            <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Binance Futures..."
                className="tv-input text-xs w-full"
            />
            <div className="max-h-60 overflow-y-auto no-scrollbar">
                {matches.map(m => {
                    const isAdded = symbols.includes(m.symbol);
                    const p = prices[m.symbol]?.price || '—';
                    return (
                        <div
                            key={m.symbol}
                            onClick={() => handleAdd(m.symbol)}
                            className={`flex items-center justify-between px-2 py-2 text-xs rounded ${isAdded ? 'opacity-50 cursor-default' : 'hover:bg-tv-hover cursor-pointer'}`}
                        >
                            <div className="flex gap-2 items-center">
                                {isAdded ? (
                                    <svg className="text-tv-green shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                                ) : (
                                    <svg className="text-gray-500 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                                )}
                                <span className="font-bold text-gray-200">{m.symbol}</span>
                            </div>
                            <span className="text-gray-400 font-mono">{p}</span>
                        </div>
                    );
                })}
                {matches.length === 0 && search && (
                    <div className="text-center text-xs text-tv-muted py-2">No matches found</div>
                )}
            </div>
        </div>
    );
}

function WatchlistTab() {
    const symbols = useWatchlistStore(s => s.symbols);
    const addSymbol = useWatchlistStore(s => s.addSymbol);
    const removeSymbol = useWatchlistStore(s => s.removeSymbol);
    const reorderSymbol = useWatchlistStore(s => s.reorderSymbol);
    const prices = useMarketStore(s => s.prices);
    const multiTfChanges = useMarketStore(s => s.multiTfChanges);
    const activeSymbol = useChartStore(s => s.activeSymbol);
    const setSymbol = useChartStore(s => s.setSymbol);

    const [showAddPicker, setShowAddPicker] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [colWarning, setColWarning] = useState(false);

    // Drag to reorder state
    const [dragState, setDragState] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);

    const [columns, setColumns] = useState(() => {
        const saved = localStorage.getItem('nexus-watchlist-columns');
        return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
    });
    const [symbolDisplay, setSymbolDisplay] = useState(() => {
        return localStorage.getItem('nexus-watchlist-symbol-display') || 'ticker_exchange';
    });

    useEffect(() => { localStorage.setItem('nexus-watchlist-columns', JSON.stringify(columns)); }, [columns]);
    useEffect(() => { localStorage.setItem('nexus-watchlist-symbol-display', symbolDisplay); }, [symbolDisplay]);

    const toggleColumn = (key) => {
        setColumns(prev => {
            const next = { ...prev, [key]: !prev[key] };
            const activeCount = Object.values(next).filter(Boolean).length;
            if (activeCount > 3) {
                setColWarning(true);
                setTimeout(() => setColWarning(false), 2000);
                return prev;
            }
            return next;
        });
    };

    const handleDragStart = (e, index, sym) => {
        const rowDom = e.currentTarget.closest('.watchlist-row-container');
        if (!rowDom) return;
        const rect = rowDom.getBoundingClientRect();
        setDragState({
            index, sym,
            startY: e.clientY,
            y: rect.top,
            offset: e.clientY - rect.top,
            width: rect.width,
            height: rect.height,
            prices: prices[sym],
            multiTf: multiTfChanges[sym]
        });
        setHoverIndex(index);
        document.body.style.userSelect = 'none';

        let localHover = index;

        const onMove = (moveEvent) => {
            setDragState(prev => prev ? { ...prev, y: moveEvent.clientY - prev.offset } : null);

            const listDom = document.getElementById('watchlist-scroll-container');
            if (!listDom) return;
            const rows = Array.from(listDom.children).filter(el => el.classList.contains('watchlist-row-container'));
            let foundIdx = localHover;
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i].getBoundingClientRect();
                if (moveEvent.clientY >= r.top && moveEvent.clientY <= r.bottom) {
                    foundIdx = i;
                    break;
                }
            }
            if (foundIdx !== localHover) {
                localHover = foundIdx;
                setHoverIndex(foundIdx);
            }
        };

        const onUp = (upEvent) => {
            document.body.style.userSelect = '';
            if (localHover !== null && localHover !== index) {
                reorderSymbol(index, localHover);
            }
            setDragState(null);
            setHoverIndex(null);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('keydown', onEsc);
        };

        const onEsc = (escEvent) => {
            if (escEvent.key === 'Escape') {
                document.body.style.userSelect = '';
                setDragState(null);
                setHoverIndex(null);
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                window.removeEventListener('keydown', onEsc);
            }
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('keydown', onEsc);
    };

    return (
        <div className="flex flex-col h-full bg-tv-panel relative text-tv-text">
            {/* Toolbar */}
            <div className="p-3 border-b border-tv-border flex items-center justify-between gap-2 relative z-50">
                <div className="font-bold text-gray-200">Watchlist</div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { setShowAddPicker(!showAddPicker); setShowSettings(false); }}
                        className={`p-1.5 rounded hover:bg-tv-hover transition-colors ${showAddPicker ? 'text-tv-blue bg-tv-hover' : 'text-gray-400'}`}
                        title="Add Symbol"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                    <button
                        onClick={() => { setShowSettings(!showSettings); setShowAddPicker(false); }}
                        className={`p-1.5 rounded hover:bg-tv-hover transition-colors ${showSettings ? 'text-tv-blue bg-tv-hover' : 'text-gray-400'}`}
                        title="Settings"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
                    </button>
                </div>
            </div>

            {showAddPicker && <AddSymbolPicker onClose={() => setShowAddPicker(false)} />}

            {/* Settings Dropdown */}
            {showSettings && (
                <div className="absolute top-[52px] right-2 z-50 w-56 bg-tv-panel border border-tv-border rounded shadow-xl py-2 text-sm">
                    <div className="px-3 py-1 flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-500">CUSTOMIZE COLUMNS</span>
                        {colWarning && <span className="text-[10px] text-tv-red bg-tv-red/10 px-1.5 py-0.5 rounded animate-pulse">Max 3</span>}
                    </div>
                    {[
                        { key: 'price', label: 'Price' },
                        { key: 'change', label: 'Change' },
                        { key: 'changePercent', label: 'Change %' },
                        { key: 'volume', label: 'Volume' },
                        { key: 'tf1h', label: '1H %' },
                        { key: 'tf4h', label: '4H %' },
                        { key: 'tf1d', label: '1D %' },
                        { key: 'tf1w', label: '1W %' },
                    ].map(col => (
                        <label key={col.key} className="flex items-center px-4 py-1.5 hover:bg-tv-hover cursor-pointer">
                            <input
                                type="checkbox"
                                className="mr-3 accent-tv-blue"
                                checked={columns[col.key]}
                                onChange={() => toggleColumn(col.key)}
                            />
                            {col.label}
                        </label>
                    ))}
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 mt-2 mb-1 border-t border-tv-border pt-3">SYMBOL DISPLAY</div>
                    <label className="flex items-center px-4 py-1.5 hover:bg-tv-hover cursor-pointer">
                        <input
                            type="radio"
                            name="symDisplay"
                            className="mr-3 accent-tv-blue"
                            checked={symbolDisplay === 'ticker_exchange'}
                            onChange={() => setSymbolDisplay('ticker_exchange')}
                        />
                        Ticker + Exchange
                    </label>
                    <label className="flex items-center px-4 py-1.5 hover:bg-tv-hover cursor-pointer">
                        <input
                            type="radio"
                            name="symDisplay"
                            className="mr-3 accent-tv-blue"
                            checked={symbolDisplay === 'ticker'}
                            onChange={() => setSymbolDisplay('ticker')}
                        />
                        Ticker only
                    </label>
                </div>
            )}

            {/* Header Row */}
            <div className="flex text-[11px] text-gray-400 px-4 pl-7 py-1.5 border-b border-tv-border font-medium shrink-0">
                <div className="flex-1">Symbol</div>
                <div className="w-[48px] mr-2 shrink-0" />
                {columns.price && <div className="w-20 text-right">Price</div>}
                {columns.change && <div className="w-14 text-right">Chg</div>}
                {columns.changePercent && <div className="w-16 text-right flex justify-end">Chg%</div>}
                {columns.volume && <div className="w-14 text-right">Vol</div>}
                {columns.tf1h && <div className="w-12 text-right">1H%</div>}
                {columns.tf4h && <div className="w-12 text-right">4H%</div>}
                {columns.tf1d && <div className="w-12 text-right">1D%</div>}
                {columns.tf1w && <div className="w-12 text-right">1W%</div>}
            </div>

            {/* List */}
            <div id="watchlist-scroll-container" className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-10 relative">
                {symbols.map((sym, index) => (
                    <WatchlistRow
                        key={sym}
                        sym={sym}
                        index={index}
                        isActive={activeSymbol === sym}
                        data={prices[sym]}
                        multiTf={multiTfChanges[sym]}
                        setSymbol={setSymbol}
                        removeSymbol={removeSymbol}
                        columns={columns}
                        symbolDisplay={symbolDisplay}
                        onDragStart={(e) => handleDragStart(e, index, sym)}
                        isHoveredDrop={hoverIndex === index}
                        isBeingDragged={dragState?.index === index}
                    />
                ))}

                {/* Drag Ghost Overlay */}
                {dragState && (
                    <div
                        className="fixed pointer-events-none opacity-90 z-50 bg-tv-panel shadow-2xl border border-tv-border flex items-center shrink-0 pr-4 drop-shadow-2xl"
                        style={{ top: dragState.y, width: dragState.width, height: dragState.height, left: 0 }}
                    >
                        <div className="w-5 h-full flex items-center justify-center -ml-2 mr-1 text-tv-blue shrink-0">
                            <svg width="10" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="2" /><circle cx="15" cy="5" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="9" cy="19" r="2" /><circle cx="15" cy="19" r="2" /></svg>
                        </div>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white mr-2 shrink-0" style={{ backgroundColor: getSeedColor(dragState.sym) }}>
                            {dragState.sym.charAt(0)}
                        </div>
                        <div className="font-bold text-tv-blue text-[13px]">{dragState.sym}</div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper generic seeded color
const getSeedColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 50%)`;
};

function WatchlistRow({ sym, index, isActive, data, multiTf, setSymbol, removeSymbol, columns, symbolDisplay, onDragStart, isHoveredDrop, isBeingDragged }) {
    const [flashClass, setFlashClass] = useState('');
    const prevPriceRef = useRef(data?.price);

    // Swipe State
    const [swipeX, setSwipeX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isSnapped, setIsSnapped] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);

    const startXRef = useRef(0);

    useEffect(() => {
        if (!data?.price || !prevPriceRef.current) {
            prevPriceRef.current = data?.price;
            return;
        }
        if (data.price > prevPriceRef.current) setFlashClass('flash-green');
        else if (data.price < prevPriceRef.current) setFlashClass('flash-red');

        prevPriceRef.current = data.price;
        const t = setTimeout(() => setFlashClass(''), 400);
        return () => clearTimeout(t);
    }, [data?.price]);

    const handlePointerDown = (e) => {
        if (e.target.closest('.drag-handle') || e.target.closest('.delete-zone')) return;
        startXRef.current = e.clientX || (e.touches && e.touches[0].clientX);
        setIsDragging(true);
        if (isSnapped) setIsSnapped(false);
    };

    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const history = data?.history || [];

        if (history.length < 2) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const min = Math.min(...history);
        const max = Math.max(...history);
        const range = max - min || 1;

        const isTrendUp = history[history.length - 1] >= history[0];
        ctx.strokeStyle = isTrendUp ? '#26a69a' : '#ef5350';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        history.forEach((val, i) => {
            const x = (i / (history.length - 1)) * w;
            const y = h - ((val - min) / range) * h;
            const paddedY = 2 + (y * ((h - 4) / h));
            if (i === 0) ctx.moveTo(x, paddedY);
            else ctx.lineTo(x, paddedY);
        });
        ctx.stroke();
    }, [data?.history]);

    const handlePointerMove = (e) => {
        if (!isDragging) return;
        const currentX = e.clientX || (e.touches && e.touches[0].clientX);
        const deltaX = currentX - startXRef.current;
        if (deltaX < 0) setSwipeX(Math.max(deltaX, -80));
        else setSwipeX(0);
    };

    const handlePointerUp = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (swipeX <= -60) {
            setSwipeX(-80);
            setIsSnapped(true);
        } else {
            setSwipeX(0);
        }
    };

    useEffect(() => {
        if (!isSnapped) return;
        const handler = (e) => {
            if (e.target.closest('.delete-zone')) return;
            setSwipeX(0);
            setIsSnapped(false);
        };
        window.addEventListener('pointerdown', handler);
        return () => window.removeEventListener('pointerdown', handler);
    }, [isSnapped]);

    const commitRemove = () => {
        setIsRemoving(true);
        setTimeout(() => removeSymbol(sym), 200);
    };

    // Derived Display Data
    const p = data?.price ? data.price.toFixed(sym.includes('SHIB') || sym.includes('PEPE') ? 6 : 2) : '—';
    const c = data?.change24h !== undefined ? data.change24h : null;
    const isUp = c >= 0;

    const formatVol = (v) => {
        if (!v) return '—';
        if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
        if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
        if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
        return v.toFixed(0);
    };

    const tfe = multiTf || {};
    const renderTf = (val) => {
        if (val === undefined) return '—';
        const clr = val > 0 ? 'text-tv-green' : val < 0 ? 'text-tv-red' : 'text-tv-muted';
        const sign = val > 0 ? '+' : '';
        return <span className={`${clr} opacity-80`}>{sign}{val.toFixed(1)}%</span>;
    };

    const absChange = c !== null ? Math.abs(c * (data?.price / 100)).toFixed(sym.includes('SHIB') ? 6 : 2) : '—';

    if (isBeingDragged) return <div className="h-[44px] bg-tv-hover/20 pointer-events-none" />;

    return (
        <div
            className={`watchlist-row-container relative overflow-hidden text-[13px] tabular-nums transition-all duration-200 ease-out 
                ${isRemoving ? 'h-0 opacity-0' : 'h-[44px] opacity-100'}`}
            style={{ borderTop: isHoveredDrop ? '2px solid #2962ff' : '2px solid transparent' }}
        >
            {/* Delete Back-layer */}
            <div
                className="delete-zone absolute right-0 top-0 bottom-0 w-[80px] bg-tv-red/20 flex items-center justify-center text-white cursor-pointer hover:bg-tv-red/40"
                onClick={(e) => { e.stopPropagation(); commitRemove(); }}
            >
                <div className="flex flex-col items-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wider">Remove</span>
                </div>
            </div>

            {/* Front Swipeable Row */}
            <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={(e) => {
                    if (e.target.closest('.drag-handle') || swipeX !== 0) return;
                    setSymbol(sym);
                }}
                className={`absolute inset-0 flex items-center px-4 py-1.5 cursor-pointer border-l-2 group bg-tv-panel
                    ${!isDragging ? 'transition-transform duration-150 ease-out' : ''}
                    ${isActive ? 'bg-tv-blue/10 border-tv-blue' : 'hover:bg-tv-hover border-transparent'}
                `}
                style={{
                    transform: `translateX(${swipeX}px)`,
                    touchAction: 'pan-y',
                    userSelect: 'none'
                }}
            >
                {/* Drag Handle (Left side) */}
                <div
                    className="drag-handle w-5 h-full flex items-center justify-center -ml-2 mr-1 text-tv-muted hover:text-gray-300 cursor-grab shrink-0"
                    onMouseDown={onDragStart}
                    title="Drag to reorder"
                >
                    <svg width="10" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="2" /><circle cx="15" cy="5" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="9" cy="19" r="2" /><circle cx="15" cy="19" r="2" /></svg>
                </div>

                <div className="flex-1 flex items-center min-w-[80px] pr-2 shrink-0">
                    <div className="flex flex-col truncate">
                        <span className={`truncate ${isActive ? 'text-tv-blue font-bold' : 'font-semibold text-gray-200'}`}>{sym}</span>
                        {symbolDisplay === 'ticker_exchange' && <span className="text-[10px] text-gray-500 leading-none mt-0.5">BINANCE</span>}
                    </div>
                </div>

                {/* Sparkline Canvas */}
                <div className="w-[48px] shrink-0 flex items-center justify-center mr-2">
                    <canvas ref={canvasRef} width={48} height={20} className="w-[48px] h-[20px]" />
                </div>

                {/* Optional Columns */}
                {columns.price && <div className={`w-20 text-right font-mono transition-colors shrink-0 ${flashClass} ${isActive && !flashClass ? 'text-tv-blue' : 'text-gray-100'}`}>{p}</div>}
                {columns.change && <div className={`w-14 text-right shrink-0 ${c !== null ? (isUp ? 'text-tv-green' : 'text-tv-red') : 'text-gray-500'}`}>{c !== null ? `${absChange}` : '—'}</div>}
                {columns.changePercent && (
                    <div className="w-16 text-right flex justify-end shrink-0">
                        {c !== null ? (
                            <span className={`px-1.5 py-0.5 rounded-sm text-[11px] font-medium ${isUp ? 'bg-tv-green/10 text-tv-green' : 'bg-tv-red/10 text-tv-red'}`}>
                                {isUp ? '+' : ''}{c.toFixed(2)}%
                            </span>
                        ) : <span className="text-gray-500">—</span>}
                    </div>
                )}
                {columns.volume && <div className="w-14 text-right text-gray-400 shrink-0">{formatVol(data?.volume24h)}</div>}
                {columns.tf1h && <div className="w-12 text-right text-[11px] shrink-0">{renderTf(tfe['1h'])}</div>}
                {columns.tf4h && <div className="w-12 text-right text-[11px] shrink-0">{renderTf(tfe['4h'])}</div>}
                {columns.tf1d && <div className="w-12 text-right text-[11px] shrink-0">{renderTf(tfe['1d'])}</div>}
                {columns.tf1w && <div className="w-12 text-right text-[11px] shrink-0">{renderTf(tfe['1w'])}</div>}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicators Tab
// ─────────────────────────────────────────────────────────────────────────────

const NumberStepper = ({ value, onChange, label }) => (
    <div className="flex items-center justify-between bg-tv-bg border border-tv-border rounded px-2 py-1">
        <span className="text-[10px] text-gray-500 uppercase">{label}</span>
        <div className="flex items-center gap-2">
            <button onClick={() => onChange(value - 1)} className="text-gray-400 hover:text-white px-1.5">−</button>
            <span className="text-xs font-mono">{value}</span>
            <button onClick={() => onChange(value + 1)} className="text-gray-400 hover:text-white px-1.5">+</button>
        </div>
    </div>
);

const LineStyleButtons = ({ value, onChange }) => (
    <div className="flex border border-tv-border rounded overflow-hidden">
        <button onClick={() => onChange(0)} className={`flex-1 flex items-center justify-center p-1 ${value === 0 ? 'bg-tv-blue text-white' : 'bg-tv-bg text-gray-400 hover:bg-tv-hover'}`} title="Solid">
            <svg width="14" height="14" viewBox="0 0 24 24"><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <button onClick={() => onChange(1)} className={`flex-1 flex items-center justify-center p-1 border-l border-tv-border ${value === 1 ? 'bg-tv-blue text-white' : 'bg-tv-bg text-gray-400 hover:bg-tv-hover'}`} title="Dashed">
            <svg width="14" height="14" viewBox="0 0 24 24"><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" /></svg>
        </button>
        <button onClick={() => onChange(2)} className={`flex-1 flex items-center justify-center p-1 border-l border-tv-border ${value === 2 ? 'bg-tv-blue text-white' : 'bg-tv-bg text-gray-400 hover:bg-tv-hover'}`} title="Dotted">
            <svg width="14" height="14" viewBox="0 0 24 24"><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeDasharray="1 4" strokeLinecap="round" /></svg>
        </button>
    </div>
);

const MiniColorLine = ({ color, styleInt }) => {
    const canvasRef = useRef(null);
    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, 40, 10);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (styleInt === 1) ctx.setLineDash([4, 4]);
        else if (styleInt === 2) ctx.setLineDash([1, 4]);
        else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(2, 5);
        ctx.lineTo(38, 5);
        ctx.stroke();
    }, [color, styleInt]);
    return <canvas ref={canvasRef} width={40} height={10} className="w-[40px] h-[10px] shrink-0 opacity-80" />;
};

function IndicatorsTab() {
    const { indicators, toggleIndicator, indicatorColors, indicatorParams, setIndicatorParam, setIndicatorColor } = useChartStore();
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [expanded, setExpanded] = useState(null);

    const CATEGORIES = ['All', 'Moving Avg', 'Oscillators', 'MACD / Trend', 'Volatility', 'Volume'];

    const inds = [
        { key: 'ema_21', label: 'EMA 21', category: 'Moving Avg', params: ['period'] },
        { key: 'ema_50', label: 'EMA 50', category: 'Moving Avg', params: ['period'] },
        { key: 'ema_100', label: 'EMA 100', category: 'Moving Avg', params: ['period'] },
        { key: 'ema_200', label: 'EMA 200', category: 'Moving Avg', params: ['period'] },
        { key: 'sma_20', label: 'SMA 20', category: 'Moving Avg', params: ['period'] },
        { key: 'sma_50', label: 'SMA 50', category: 'Moving Avg', params: ['period'] },
        { key: 'sma_200', label: 'SMA 200', category: 'Moving Avg', params: ['period'] },
        { key: 'vwma_20', label: 'VWMA 20', category: 'Moving Avg', params: ['period'] },
        { key: 'rsi', label: 'RSI', category: 'Oscillators', params: ['period', 'obLevel', 'osLevel'] },
        { key: 'stoch', label: 'Stochastic', category: 'Oscillators', params: ['kPeriod', 'kSmooth', 'dSmooth'] },
        { key: 'stochrsi', label: 'Stochastic RSI', category: 'Oscillators', params: ['rsiPeriod', 'stochPeriod', 'kSmooth', 'dSmooth'] },
        { key: 'williams_r', label: 'Williams %R', category: 'Oscillators', params: ['period'] },
        { key: 'cci', label: 'CCI', category: 'Oscillators', params: ['period'] },
        { key: 'macd', label: 'MACD', category: 'MACD / Trend', params: ['fast', 'slow', 'signal'] },
        { key: 'supertrend', label: 'Supertrend', category: 'MACD / Trend', params: ['period', 'multiplier'] },
        { key: 'ichimoku', label: 'Ichimoku Cloud', category: 'MACD / Trend', params: ['tenkan', 'kijun', 'senkouB', 'displacement'] },
        { key: 'adx', label: 'ADX', category: 'MACD / Trend', params: ['period'] },
        { key: 'bb', label: 'Bollinger Bands', category: 'Volatility', params: ['period', 'stdDev'] },
        { key: 'atr_channel', label: 'ATR Channel', category: 'Volatility', params: ['period', 'multiplier'] },
        { key: 'vwap', label: 'VWAP', category: 'Volume', params: [] },
        { key: 'obv', label: 'OBV', category: 'Volume', params: [] },
        { key: 'volume_ma', label: 'Volume MA', category: 'Volume', params: ['period'] },
    ];

    const isCategoryActive = (cat) => {
        if (cat === 'All') return Object.values(indicators).some(v => v);
        return inds.filter(i => i.category === cat).some(i => indicators[i.key]);
    };

    const filtered = inds.filter(i => {
        if (activeCategory !== 'All' && i.category !== activeCategory) return false;
        if (search && !i.label.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="flex flex-col h-full bg-tv-panel relative overflow-hidden">
            <div className="p-2 border-b border-tv-border flex items-center justify-between shrink-0 bg-tv-bg">
                <input
                    type="text"
                    placeholder="Search indicators..."
                    className="tv-input text-xs w-full py-1.5 px-3"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            <div className="flex flex-1 overflow-hidden">
                {/* Left Pane: Categories */}
                <div className="w-[100px] border-r border-tv-border bg-tv-bg flex flex-col shrink-0 overflow-y-auto no-scrollbar py-2">
                    {CATEGORIES.map(cat => {
                        const active = isCategoryActive(cat);
                        return (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`text-[11px] font-medium text-left px-3 py-2 flex items-center gap-1.5 hover:bg-tv-hover transition-colors ${activeCategory === cat ? 'bg-tv-hover text-tv-blue' : 'text-gray-400'}`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-tv-blue' : 'bg-transparent border border-gray-600'}`} />
                                <span className="truncate">{cat}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Right Pane: Indicators list */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-2 flex flex-col gap-1.5">
                    {filtered.map(ind => {
                        const baseColorKey = indicatorColors[ind.key] ? ind.key : indicatorColors[`${ind.key}_line`] ? `${ind.key}_line` : indicatorColors[`${ind.key}_k`] ? `${ind.key}_k` : ind.key;
                        const color = indicatorColors[baseColorKey] || '#2962ff';
                        const params = indicatorParams[ind.key] || {};
                        const lineStyle = params.lineStyle || 0;
                        const isOn = indicators[ind.key];
                        const isExpanded = expanded === ind.key;

                        return (
                            <div key={ind.key} className={`border rounded transition-colors ${isOn ? 'border-tv-blue/30 bg-tv-blue/5' : 'border-tv-border bg-tv-bg hover:border-gray-500/50'}`}>
                                <div className="flex items-center gap-2 p-2">
                                    <div
                                        className="cursor-pointer flex items-center justify-center shrink-0 w-4 h-4 rounded border border-gray-500 hover:border-tv-blue"
                                        onClick={() => toggleIndicator(ind.key)}
                                    >
                                        {isOn && <div className="w-2.5 h-2.5 bg-tv-blue rounded-sm" />}
                                    </div>
                                    <span className="text-[12px] font-bold text-gray-200 flex-1 truncate">{ind.label}</span>

                                    <MiniColorLine color={color} styleInt={lineStyle} />

                                    <button
                                        onClick={(e) => { e.preventDefault(); setExpanded(isExpanded ? null : ind.key); }}
                                        className={`text-[10px] shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors ${isExpanded ? 'bg-tv-blue text-white' : 'text-gray-500 hover:bg-tv-hover hover:text-white'}`}
                                    >⚙</button>
                                </div>

                                {isExpanded && (
                                    <div className="px-2 pb-2 pt-1 border-t border-tv-border/50 flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-2 bg-tv-panel p-1.5 rounded border border-tv-border">
                                            <div className="flex items-center gap-1.5 pl-1 flex-1">
                                                <input
                                                    type="color"
                                                    value={color}
                                                    onChange={(e) => setIndicatorColor(baseColorKey, e.target.value)}
                                                    className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                                                />
                                                <span className="text-[10px] font-bold text-gray-300">COLOR / STYLE</span>
                                            </div>
                                            <div className="w-20">
                                                <LineStyleButtons
                                                    value={lineStyle}
                                                    onChange={(val) => setIndicatorParam(ind.key, 'lineStyle', val)}
                                                />
                                            </div>
                                        </div>

                                        {ind.params.length > 0 && (
                                            <div className="grid grid-cols-1 gap-1.5 mt-0.5">
                                                {ind.params.map(pk => (
                                                    <NumberStepper
                                                        key={pk}
                                                        label={pk}
                                                        value={params[pk] ?? 0}
                                                        onChange={(val) => setIndicatorParam(ind.key, pk, val)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div className="text-center text-xs text-tv-muted py-6">No indicators found.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alerts Tab (Engine Log + Trigger Button)
// ─────────────────────────────────────────────────────────────────────────────
function AlertsTab() {
    const { alerts, history, togglePause, removeAlert } = useAlertStore();
    const activeCount = alerts.filter(a => a.armed && !a.paused).length;

    return (
        <div className="flex flex-col h-full relative">
            <div className="p-3 border-b border-tv-border flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300 uppercase">Alerts ({activeCount})</span>
                <button
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('nexus:open-alert-creator'));
                    }}
                    className="text-xs text-tv-blue hover:text-blue-400 font-medium"
                >+ Add 🔔</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                {alerts.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 mt-10">
                        No active alerts.<br />Click + Add to create one.
                    </div>
                ) : (
                    alerts.map(a => {
                        let statusColor = 'text-gray-500';
                        let borderColor = 'border-tv-border/50';
                        let statusText = '🔕 Disarmed';

                        if (a.armed && !a.paused) {
                            statusColor = 'text-tv-blue';
                            borderColor = 'border-tv-blue/30';
                            statusText = '🔥 Armed';
                        } else if (a.armed && a.paused) {
                            statusColor = 'text-amber-500';
                            borderColor = 'border-amber-500/30';
                            statusText = '⏸ Paused';
                        }

                        return (
                            <div key={a.id} className={`mb-3 p-3 bg-tv-bg rounded border ${borderColor} text-sm transition-colors`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`${statusColor} font-bold`}>{a.name}</span>
                                    <span className="text-xs text-gray-500 bg-bg-input px-1.5 py-0.5 rounded border border-tv-border">{a.symbol}</span>
                                </div>
                                <div className="text-xs text-gray-400">
                                    Type: {a.type.replace(/_/g, ' ')}
                                </div>
                                <div className="flex justify-between items-center mt-3">
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => togglePause(a.id)}
                                            className="px-2 py-1 bg-bg-input border border-tv-border rounded text-[10px] hover:text-white transition-colors"
                                        >
                                            {a.paused ? '▶ Resume' : '⏸ Pause'}
                                        </button>
                                        <button
                                            onClick={() => removeAlert(a.id)}
                                            className="px-2 py-1 bg-[rgba(239,83,80,0.1)] text-[#ef5350] border border-[rgba(239,83,80,0.2)] rounded text-[10px] hover:bg-[#ef5350] hover:text-white transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                    <div className="text-[10px] flex flex-col items-end">
                                        <span className={statusColor}>{statusText}</span>
                                        <span className="text-gray-500 mt-0.5" title="Triggers">{a.fireCount} flags {a.lastFiredAt ? `• ${new Date(a.lastFiredAt).toLocaleTimeString()}` : ''}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="h-1/3 border-t border-tv-border bg-tv-panel flex flex-col">
                <div className="p-2 border-b border-tv-border bg-black/20 text-xs font-bold text-gray-400 uppercase">
                    Alert Log ({history.length})
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
                    {history.map(h => (
                        <div key={h.id} className="text-[11px] text-gray-300 flex flex-col">
                            <span className="text-tv-blue">{h.symbol} • {new Date(h.firedAt).toLocaleTimeString()}</span>
                            <span>{h.message}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Tab (CoinGecko Token Data)
// ─────────────────────────────────────────────────────────────────────────────
const mapSymbolToId = { BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', SOLUSDT: 'solana', DOGEUSDT: 'dogecoin', XRPUSDT: 'ripple', ADAUSDT: 'cardano', AVAXUSDT: 'avalanche-2', LINKUSDT: 'chainlink' };

function formatSupply(num) {
    if (!num) return '—';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
}

function DataTab() {
    const symbol = useChartStore(s => s.activeSymbol);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showMoreDesc, setShowMoreDesc] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setError(null);
        setData(null);

        const coinId = mapSymbolToId[symbol] || 'bitcoin';

        fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=false`)
            .then(res => {
                if (!res.ok) throw new Error('API Error');
                return res.json();
            })
            .then(json => {
                if (mounted) {
                    setData(json);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (mounted) {
                    setError(err.message);
                    setLoading(false);
                }
            });

        return () => { mounted = false; };
    }, [symbol]);

    return (
        <div className="flex flex-col h-full bg-tv-panel text-sm text-gray-200">
            <h2 className="text-[16px] font-bold text-white p-4 pb-2 border-b border-tv-border flex items-center justify-between shrink-0">
                {symbol} Intel
                <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded uppercase tracking-wider font-semibold border border-indigo-500/30">CoinGecko</span>
            </h2>

            {loading ? (
                <div className="p-4 space-y-4">
                    <div className="h-12 bg-tv-border animate-pulse rounded" />
                    <div className="h-24 bg-tv-border animate-pulse rounded" />
                    <div className="h-24 bg-tv-border animate-pulse rounded" />
                    <div className="h-20 bg-tv-border animate-pulse rounded" />
                </div>
            ) : error ? (
                <div className="p-4 text-center text-tv-red text-xs mt-10">
                    <div className="mb-2 text-2xl">⚠️</div>
                    Failed to fetch data from CoinGecko.<br />Rate limit exceeded or network error.
                </div>
            ) : data ? (
                <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 pb-8">

                    {/* Header Info */}
                    <div className="flex items-center gap-3 bg-bg-input border border-tv-border p-3 rounded shadow-sm">
                        {data.image?.small && <img src={data.image.small} alt={data.name} className="w-8 h-8 rounded-full" />}
                        <div className="flex flex-col">
                            <span className="font-bold text-base text-white leading-tight">{data.name} <span className="text-gray-500 font-normal uppercase text-xs ml-1">{data.symbol}</span></span>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 font-medium tracking-wide">
                                {data.market_cap_rank && <span className="bg-tv-panel px-1.5 py-0.5 rounded">Rank #{data.market_cap_rank}</span>}
                                {data.genesis_date && <span>Gen: {data.genesis_date}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    {data.description?.en && (
                        <div className="bg-bg-input border border-tv-border rounded py-2 px-3 shadow-sm text-[11px] leading-relaxed text-gray-400">
                            <h3 className="text-[10px] font-bold text-tv-muted uppercase mb-1.5 tracking-wider">About</h3>
                            <div className={`overflow-hidden transition-all ${!showMoreDesc ? 'line-clamp-3' : ''}`}>
                                {data.description.en.replace(/<[^>]+>/g, '')}
                            </div>
                            <button onClick={() => setShowMoreDesc(!showMoreDesc)} className="text-tv-blue text-[10px] mt-1 hover:underline font-medium">
                                {showMoreDesc ? 'Show less' : 'Show more'}
                            </button>
                        </div>
                    )}

                    {/* Market Data */}
                    <div className="bg-bg-input border border-tv-border rounded py-2 px-3 shadow-sm">
                        <h3 className="text-[10px] font-bold text-tv-muted uppercase mb-2 tracking-wider">Market Supply & ATH</h3>
                        <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                            <div className="text-tv-muted">Circulating Supply</div>
                            <div className="text-right font-medium tabular-nums text-gray-200">{formatSupply(data.market_data?.circulating_supply)}</div>

                            <div className="text-tv-muted">Total Supply</div>
                            <div className="text-right font-medium tabular-nums text-gray-200">{formatSupply(data.market_data?.total_supply)}</div>

                            <div className="text-tv-muted">Max Supply</div>
                            <div className="text-right font-medium tabular-nums text-gray-200">{formatSupply(data.market_data?.max_supply)}</div>

                            <div className="text-tv-muted mt-1">All-Time High</div>
                            <div className="text-right font-medium tabular-nums text-tv-green mt-1">${data.market_data?.ath?.usd?.toLocaleString()}</div>

                            <div className="text-tv-muted">ATH Date</div>
                            <div className="text-right font-medium tabular-nums text-gray-400">{data.market_data?.ath_date?.usd ? new Date(data.market_data.ath_date.usd).toLocaleDateString() : '—'}</div>
                        </div>
                    </div>

                    {/* Developer */}
                    {data.developer_data && (
                        <div className="bg-bg-input border border-tv-border rounded py-2 px-3 shadow-sm">
                            <h3 className="text-[10px] font-bold text-tv-muted uppercase mb-2 tracking-wider flex items-center justify-between">
                                Developer Activity
                                <span className="text-[9px] bg-tv-panel px-1.5 py-0.5 rounded text-gray-500">GitHub</span>
                            </h3>
                            <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                                <div className="text-tv-muted">Stars</div>
                                <div className="text-right font-medium tabular-nums">{data.developer_data.stars?.toLocaleString() || '—'}</div>
                                <div className="text-tv-muted">Forks</div>
                                <div className="text-right font-medium tabular-nums">{data.developer_data.forks?.toLocaleString() || '—'}</div>
                                <div className="text-tv-muted">Subscribers</div>
                                <div className="text-right font-medium tabular-nums">{data.developer_data.subscribers?.toLocaleString() || '—'}</div>
                                <div className="text-tv-muted">Total Issues</div>
                                <div className="text-right font-medium tabular-nums">{data.developer_data.total_issues?.toLocaleString() || '—'}</div>
                            </div>
                        </div>
                    )}

                    {/* Links */}
                    {data.links && (
                        <div className="bg-bg-input border border-tv-border rounded py-2 px-3 shadow-sm">
                            <h3 className="text-[10px] font-bold text-tv-muted uppercase mb-2 tracking-wider">Official Links</h3>
                            <div className="flex flex-col gap-1.5 text-[11px]">
                                {data.links.homepage?.[0] && (
                                    <a href={data.links.homepage[0]} target="_blank" rel="noreferrer" className="text-tv-blue hover:underline flex items-center justify-between">
                                        Website <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
                                    </a>
                                )}
                                {data.links.blockchain_site?.[0] && (
                                    <a href={data.links.blockchain_site[0]} target="_blank" rel="noreferrer" className="text-tv-blue hover:underline flex items-center justify-between">
                                        Explorer <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
                                    </a>
                                )}
                                {data.links.twitter_screen_name && (
                                    <a href={`https://twitter.com/${data.links.twitter_screen_name}`} target="_blank" rel="noreferrer" className="text-tv-blue hover:underline flex items-center justify-between">
                                        Twitter @{data.links.twitter_screen_name} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            ) : null}
        </div>
    );
}
