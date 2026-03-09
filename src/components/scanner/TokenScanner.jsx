import React, { useEffect, useState, useMemo, useRef } from 'react';
import useChartStore from '../../store/useChartStore.js';
import useLayoutStore from '../../store/useLayoutStore.js';
import useSettingsStore from '../../store/useSettingsStore.js';
import useAlertStore from '../../engine/alerts/useAlertStore.js';
import { fetchKlines } from '../../api/binance.js';

function standardSquarify(items) {
    // items have property 'weight'
    // Returns array of items with { rect: { x, y, w, h } } in percentages (0-100)
    const result = [];
    let currentX = 0;
    let currentY = 0;
    let currentW = 100;
    let currentH = 100;

    let remainingWeight = items.reduce((s, i) => s + i.weight, 0);
    const sorted = [...items].sort((a, b) => b.weight - a.weight);

    for (let item of sorted) {
        if (remainingWeight === 0) break;
        let ratio = item.weight / remainingWeight;
        if (currentW > currentH) {
            let sectionW = currentW * ratio;
            result.push({ ...item, rect: { x: currentX, y: currentY, w: sectionW, h: currentH } });
            currentX += sectionW;
            currentW -= sectionW;
        } else {
            let sectionH = currentH * ratio;
            result.push({ ...item, rect: { x: currentX, y: currentY, w: currentW, h: sectionH } });
            currentY += sectionH;
            currentH -= sectionH;
        }
        remainingWeight -= item.weight;
    }
    return result;
}

export default function TokenScanner() {
    const { scannerOpen, toggleScanner } = useLayoutStore();
    const setSymbol = useChartStore(s => s.setSymbol);
    const positiveColor = useSettingsStore(s => s.candleUpColor) || '#26a69a';
    const negativeColor = useSettingsStore(s => s.candleDownColor) || '#ef5350';

    const [data, setData] = useState([]); // Array of ticker objects
    const [loading, setLoading] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'quoteVolume', direction: 'desc' });
    const [search, setSearch] = useState('');
    const [isHeatmap, setIsHeatmap] = useState(false);

    const tfCache = useRef(new Map()); // symbol -> { '1m': pct, '5m': pct... }
    const [tfData, setTfData] = useState({});

    const [showSettings, setShowSettings] = useState(false);
    const [batchAlertOpen, setBatchAlertOpen] = useState(false);
    const [batchAlertConfig, setBatchAlertConfig] = useState({ condition: 'PRICE_MOVE_PCT', direction: 'down', threshold: 5, fireMode: 'once' });

    const [columns, setColumns] = useState(() => {
        const saved = localStorage.getItem('nexus-scanner-columns');
        const parsed = saved ? JSON.parse(saved) : {};
        return { tf1m: true, tf5m: true, tf1h: true, tf7d: true, tf30d: true, volatility: true, ...parsed };
    });

    // 1. WebSocket Live Ticker
    useEffect(() => {
        if (!scannerOpen) return;
        let isMounted = true;
        let ws = null;

        const init = async () => {
            setLoading(true);
            try {
                const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
                const raw = await res.json();
                const usdtPairs = raw
                    .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'))
                    .map(t => {
                        const highPrice = parseFloat(t.highPrice);
                        const lowPrice = parseFloat(t.lowPrice);
                        const volatility = lowPrice > 0 ? ((highPrice - lowPrice) / lowPrice) * 100 : 0;
                        return {
                            symbol: t.symbol,
                            price: parseFloat(t.lastPrice),
                            changePct: parseFloat(t.priceChangePercent),
                            volume: parseFloat(t.volume),
                            quoteVolume: parseFloat(t.quoteVolume),
                            volatility
                        };
                    });

                if (isMounted) {
                    setData(usdtPairs);
                    setLoading(false);
                }

                ws = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');
                ws.onmessage = (evt) => {
                    if (!isMounted) return;
                    const updates = JSON.parse(evt.data);
                    setData(prev => {
                        const lookup = new Map(updates.map(u => [u.s, u]));
                        return prev.map(item => {
                            const u = lookup.get(item.symbol);
                            if (u) {
                                const highPrice = parseFloat(u.h);
                                const lowPrice = parseFloat(u.l);
                                const volatility = lowPrice > 0 ? ((highPrice - lowPrice) / lowPrice) * 100 : item.volatility;
                                return {
                                    ...item,
                                    price: parseFloat(u.c),
                                    changePct: parseFloat(u.P),
                                    volume: parseFloat(u.v),
                                    quoteVolume: parseFloat(u.q),
                                    volatility
                                };
                            }
                            return item;
                        });
                    });
                };
            } catch (err) {
                console.error('Scanner init error', err);
                if (isMounted) setLoading(false);
            }
        };

        init();
        return () => { isMounted = false; if (ws) ws.close(); };
    }, [scannerOpen]);

    useEffect(() => { localStorage.setItem('nexus-scanner-columns', JSON.stringify(columns)); }, [columns]);

    const sortedData = useMemo(() => {
        let filtered = data;
        if (search) filtered = filtered.filter(row => row.symbol.toLowerCase().includes(search.toLowerCase()));

        const getSortValue = (row) => {
            if (sortConfig.key.startsWith('tf')) {
                return tfData[row.symbol]?.[sortConfig.key] ?? -Infinity;
            }
            return row[sortConfig.key] ?? 0;
        };

        return filtered.sort((a, b) => {
            const valA = getSortValue(a);
            const valB = getSortValue(b);
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, sortConfig, search, tfData]);

    // 2. Multi-TF Lazy Batch Loading (Top 50)
    useEffect(() => {
        if (!scannerOpen || isHeatmap || sortedData.length === 0) return;

        const timer = setTimeout(() => {
            const top50 = sortedData.slice(0, 50).map(r => r.symbol);
            const toFetch = top50.filter(sym => !tfCache.current.has(sym));
            if (toFetch.length === 0) return;

            const run = async () => {
                let active = 0;
                const queue = [...toFetch];

                const next = async () => {
                    if (queue.length === 0) return;
                    const sym = queue.shift();
                    if (tfCache.current.has(sym)) return;

                    tfCache.current.set(sym, 'pending');
                    active++;

                    try {
                        const resOpts = {
                            '1m': await fetchKlines(sym, '1m', 2),
                            '5m': await fetchKlines(sym, '5m', 2),
                            '1h': await fetchKlines(sym, '1h', 2),
                            '7d': await fetchKlines(sym, '1d', 7),
                            '30d': await fetchKlines(sym, '1d', 30),
                        };

                        const process = (k) => {
                            if (k && k.length > 0) {
                                const first = k[0].open;
                                const last = k[k.length - 1].close;
                                return ((last - first) / first) * 100;
                            }
                            return null;
                        };

                        const nextUpdates = {
                            tf1m: process(resOpts['1m']),
                            tf5m: process(resOpts['5m']),
                            tf1h: process(resOpts['1h']),
                            tf7d: process(resOpts['7d']),
                            tf30d: process(resOpts['30d']),
                        };

                        tfCache.current.set(sym, nextUpdates);
                        setTfData(prev => ({ ...prev, [sym]: nextUpdates }));
                    } catch (e) {
                        tfCache.current.delete(sym); // allow retry
                    } finally {
                        active--;
                        next();
                    }
                };

                for (let i = 0; i < Math.min(5, queue.length); i++) next();
            };
            run();
        }, 500);

        return () => clearTimeout(timer);
    }, [sortedData, scannerOpen, isHeatmap]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleCreateBatchAlert = () => {
        const { addAlert } = useAlertStore.getState();
        const visibleSlice = sortedData.slice(0, 50);

        visibleSlice.forEach((row) => {
            addAlert({
                name: `${row.symbol.replace('USDT', '')} Batch Rule`,
                symbol: row.symbol,
                type: 'PRICE_MOVE_PCT',
                params: {
                    minutes: 15,
                    threshold: parseFloat(batchAlertConfig.threshold),
                    direction: batchAlertConfig.direction === 'down' ? 'down' : (batchAlertConfig.direction === 'up' ? 'up' : 'any')
                },
                fireMode: batchAlertConfig.fireMode,
                soundEnabled: true,
                ttlMinutes: 60 * 24 * 7 // 1 week
            });
        });
        setBatchAlertOpen(false);
    };

    if (!scannerOpen) return null;

    const formatNum = (num, isPrice = false) => {
        if (isPrice) return num >= 1 ? num.toFixed(2) : num.toFixed(5);
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toFixed(2);
    };

    const renderTfCol = (sym, key) => {
        const val = tfData[sym]?.[key];
        if (val === undefined || val === null) return <span className="text-[#787b86]">...</span>;

        // Intensity scaling
        let colorClass = 'text-[#787b86]';
        if (val > 5) colorClass = 'text-[#26a69a]';
        else if (val > 1) colorClass = 'text-[#26a69a] opacity-70';
        else if (val < -5) colorClass = 'text-[#ef5350]';
        else if (val < -1) colorClass = 'text-[#ef5350] opacity-70';

        return <span className={colorClass}>{val > 0 ? '+' : ''}{val.toFixed(2)}%</span>;
    };

    // Calculate Squarified Treemap Data
    let treemapTiles = [];
    if (isHeatmap && sortedData.length > 0) {
        // limit to top 100 max to avoid performance crawl building dom elements
        const viewData = sortedData.slice(0, 100);
        const totalVol = viewData.reduce((s, r) => s + r.quoteVolume, 0);
        const tiles = viewData.map(r => ({ ...r, weight: r.quoteVolume / totalVol }));
        treemapTiles = standardSquarify(tiles);
    }

    return (
        <div className="fixed inset-0 z-[100] bg-bg-app flex flex-col pt-12 text-text-primary overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default bg-bg-panel shrink-0 relative">
                <div className="flex items-center space-x-4">
                    <h2 className="text-xl font-bold tracking-tight">Market Scanner</h2>
                    <span className="bg-bg-input text-text-secondary text-xs px-2 py-1 rounded font-mono">
                        TOP 500 FUTURES
                    </span>

                    <div className="relative">
                        <button
                            onClick={() => setBatchAlertOpen(!batchAlertOpen)}
                            className="ml-4 flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(41,98,255,0.1)] text-[#2962ff] border border-[#2962ff]/30 rounded hover:bg-[#2962ff] hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
                        >
                            Alert Top N
                        </button>

                        {batchAlertOpen && (
                            <div className="absolute top-10 left-4 z-50 w-[280px] bg-tv-panel border border-tv-border rounded shadow-2xl p-4 text-sm font-sans flex flex-col gap-3">
                                <div className="text-tv-text font-bold text-[13px]">
                                    Create Alerts for {Math.min(50, sortedData.length)} symbols
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                                    <span className="text-tv-muted text-xs">Condition:</span>
                                    <select disabled className="bg-bg-input border border-border-default rounded px-2 py-1 text-xs outline-none">
                                        <option>Price Change</option>
                                    </select>

                                    <span className="text-tv-muted text-xs">Direction:</span>
                                    <div className="flex gap-2">
                                        <select
                                            value={batchAlertConfig.direction}
                                            onChange={(e) => setBatchAlertConfig(prev => ({ ...prev, direction: e.target.value }))}
                                            className="bg-bg-input border border-border-default rounded px-2 py-1 text-xs outline-none flex-1"
                                        >
                                            <option value="up">&gt; Up</option>
                                            <option value="down">&lt; Down</option>
                                            <option value="any">± Any</option>
                                        </select>
                                        <input
                                            type="number"
                                            value={batchAlertConfig.threshold}
                                            onChange={(e) => setBatchAlertConfig(prev => ({ ...prev, threshold: e.target.value }))}
                                            className="bg-bg-input border border-border-default rounded px-2 py-1 w-16 text-xs text-center outline-none"
                                        />
                                    </div>

                                    <span className="text-tv-muted text-xs">Mode:</span>
                                    <select
                                        value={batchAlertConfig.fireMode}
                                        onChange={(e) => setBatchAlertConfig(prev => ({ ...prev, fireMode: e.target.value }))}
                                        className="bg-bg-input border border-border-default rounded px-2 py-1 text-xs outline-none"
                                    >
                                        <option value="once">Once</option>
                                        <option value="every_time">Every Time</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => setBatchAlertOpen(false)} className="px-3 py-1 bg-bg-app hover:bg-bg-input rounded text-xs text-tv-text">Cancel</button>
                                    <button onClick={handleCreateBatchAlert} className="px-3 py-1 bg-tv-blue hover:bg-blue-600 rounded text-white text-xs font-bold shadow">Create All Alerts</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <svg className="absolute left-3 top-2.5 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
                        <input
                            type="text"
                            placeholder="Search TICKER..."
                            className="bg-bg-app border border-border-default text-text-primary text-sm rounded-full pl-9 pr-4 py-1.5 focus:outline-none focus:border-tv-blue transition-colors w-48 font-mono"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded hover:bg-bg-hover transition-colors ${showSettings ? 'text-tv-blue bg-tv-hover' : 'text-text-muted'}`}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 3H3zM21 12H3zM21 21H3z" /></svg>
                        </button>

                        {showSettings && (
                            <div className="absolute top-[40px] right-0 z-50 w-48 bg-bg-panel border border-border-default rounded shadow-2xl py-2 text-sm">
                                <div className="px-3 py-1 text-xs font-semibold text-text-secondary mb-1">COLUMNS</div>
                                {[
                                    { key: 'tf1m', label: '1m Change' },
                                    { key: 'tf5m', label: '5m Change' },
                                    { key: 'tf1h', label: '1h Change' },
                                    { key: 'tf7d', label: '7d Change' },
                                    { key: 'tf30d', label: '30d Change' },
                                    { key: 'volatility', label: 'Volatility' }
                                ].map(col => (
                                    <label key={col.key} className="flex items-center px-4 py-2 hover:bg-bg-hover cursor-pointer text-gray-200">
                                        <input
                                            type="checkbox"
                                            className="mr-3 accent-tv-blue"
                                            checked={columns[col.key]}
                                            onChange={() => setColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                                        />
                                        {col.label}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setIsHeatmap(!isHeatmap)}
                        className={`tv-button px-4 py-1.5 h-auto text-sm ${isHeatmap ? 'bg-[rgba(38,166,154,0.15)] text-[#26a69a] border-[#26a69a]/30' : 'bg-bg-input'}`}
                    >
                        {isHeatmap ? '⊞ Heatmap View' : '☰ Grid View'}
                    </button>

                    <button onClick={toggleScanner} className="p-2 hover:bg-bg-hover rounded-full text-text-secondary transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 bg-bg-app relative no-scrollbar">
                {loading && data.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-tv-blue border-t-transparent flex items-center justify-center rounded-full animate-spin"></div>
                    </div>
                ) : (
                    isHeatmap ? (
                        <div className="relative w-full h-full p-2">
                            {treemapTiles.map((tile) => {
                                const isUp = tile.changePct >= 0;
                                const intensity = Math.min(Math.abs(tile.changePct) / 10, 1);
                                const bg = isUp
                                    ? `rgba(38, 166, 154, ${0.1 + intensity * 0.9})`
                                    : `rgba(239, 83, 80, ${0.1 + intensity * 0.9})`;

                                // Render symbol only if area large enough
                                const showText = (tile.rect.w > 5 && tile.rect.h > 10);

                                return (
                                    <div
                                        key={tile.symbol}
                                        onClick={() => { setSymbol(tile.symbol); toggleScanner(); }}
                                        className="absolute rounded border border-bg-app overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:z-10 transition-transform hover:scale-[1.02] group"
                                        style={{
                                            left: `${tile.rect.x}%`,
                                            top: `${tile.rect.y}%`,
                                            width: `${tile.rect.w}%`,
                                            height: `${tile.rect.h}%`,
                                            backgroundColor: bg
                                        }}
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.dispatchEvent(new CustomEvent('nexus:open-alert-creator', { detail: { symbol: tile.symbol } }));
                                                toggleScanner();
                                            }}
                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 bg-black/40 hover:bg-black/80 text-white rounded transition-all backdrop-blur-sm z-20"
                                            title="Set Alert"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                                        </button>

                                        {showText && (
                                            <>
                                                <span className={`font-bold tracking-wide ${intensity > 0.4 ? 'text-white' : 'text-gray-200'}`} style={{ fontSize: `${Math.min(tile.rect.w * 0.5, 20)}px` }}>
                                                    {tile.symbol.replace('USDT', '')}
                                                </span>
                                                {tile.rect.h > 20 && (
                                                    <span className={`font-mono text-[11px] mt-0.5 ${intensity > 0.4 ? 'text-white/90' : 'text-gray-300'}`}>
                                                        {isUp ? '+' : ''}{tile.changePct.toFixed(2)}%
                                                    </span>
                                                )}
                                                {tile.rect.h > 35 && (
                                                    <span className={`font-mono text-[9px] mt-0.5 opacity-60 ${intensity > 0.4 ? 'text-white' : 'text-gray-400'}`}>
                                                        ${formatNum(tile.quoteVolume)}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="pb-20 overflow-auto h-full px-6">
                            <table className="w-full text-left border-collapse table-fixed relative mt-2">
                                <thead>
                                    <tr className="text-[11px] text-text-secondary uppercase select-none sticky top-0 bg-bg-app z-20 shadow-[0_1px_0_var(--border-default)]">
                                        <th className="py-2 px-3 font-normal cursor-pointer hover:text-white" onClick={() => handleSort('symbol')}>
                                            Symbol {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="py-2 px-3 font-normal text-right cursor-pointer hover:text-white" onClick={() => handleSort('price')}>
                                            Price {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="py-2 px-3 font-normal text-right cursor-pointer hover:text-white" onClick={() => handleSort('changePct')}>
                                            24h {sortConfig.key === 'changePct' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        {columns.tf1m && <th className="py-2 px-3 font-normal text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('tf1m')}>1m Chg {sortConfig.key === 'tf1m' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                                        {columns.tf5m && <th className="py-2 px-3 font-normal text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('tf5m')}>5m Chg {sortConfig.key === 'tf5m' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                                        {columns.tf1h && <th className="py-2 px-3 font-normal text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('tf1h')}>1h Chg {sortConfig.key === 'tf1h' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                                        {columns.tf7d && <th className="py-2 px-3 font-normal text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('tf7d')}>7d Chg {sortConfig.key === 'tf7d' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                                        {columns.tf30d && <th className="py-2 px-3 font-normal text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('tf30d')}>30d Chg {sortConfig.key === 'tf30d' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                                        {columns.volatility && <th className="py-2 px-3 font-normal text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('volatility')}>Volat {sortConfig.key === 'volatility' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}

                                        <th className="py-2 px-3 font-normal text-right cursor-pointer hover:text-white" onClick={() => handleSort('volume')}>
                                            Vol (Base) {sortConfig.key === 'volume' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="py-2 px-3 font-normal text-right cursor-pointer hover:text-white" onClick={() => handleSort('quoteVolume')}>
                                            Vol (USDT) {sortConfig.key === 'quoteVolume' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="py-2 px-2 w-8 border-0"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedData.map((row) => {
                                        const isUp = row.changePct >= 0;
                                        return (
                                            <tr
                                                key={row.symbol}
                                                onClick={() => { setSymbol(row.symbol); toggleScanner(); }}
                                                className="border-b border-[rgba(255,255,255,0.03)] hover:bg-bg-hover cursor-pointer transition-colors group"
                                            >
                                                <td className="py-1.5 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-200 group-hover:text-tv-blue transition-colors text-[13px]">
                                                            {row.symbol.replace('USDT', '')}
                                                        </span>
                                                        <span className="bg-tv-border/50 text-text-muted text-[9px] px-1 py-0.5 rounded leading-none shrink-0">USDT</span>
                                                    </div>
                                                </td>
                                                <td className="py-1.5 px-3 text-right font-mono text-[12px] tabular-nums text-gray-200">
                                                    {formatNum(row.price, true)}
                                                </td>
                                                <td className="py-1.5 px-3 text-right font-mono text-[12px] tabular-nums">
                                                    <span style={{ color: isUp ? positiveColor : negativeColor }} className="bg-black/10 px-1.5 py-0.5 rounded">
                                                        {isUp ? '+' : ''}{row.changePct.toFixed(2)}%
                                                    </span>
                                                </td>

                                                {columns.tf1m && <td className="py-1.5 px-3 text-right font-mono text-[12px] tabular-nums">{renderTfCol(row.symbol, 'tf1m')}</td>}
                                                {columns.tf5m && <td className="py-1.5 px-3 text-right font-mono text-[12px] tabular-nums">{renderTfCol(row.symbol, 'tf5m')}</td>}
                                                {columns.tf1h && <td className="py-1.5 px-3 text-right font-mono text-[12px] tabular-nums">{renderTfCol(row.symbol, 'tf1h')}</td>}
                                                {columns.tf7d && <td className="py-1.5 px-3 text-right font-mono text-[12px] tabular-nums">{renderTfCol(row.symbol, 'tf7d')}</td>}
                                                {columns.tf30d && <td className="py-1.5 px-3 text-right font-mono text-[12px] tabular-nums">{renderTfCol(row.symbol, 'tf30d')}</td>}
                                                {columns.volatility && <td className="py-1.5 px-3 text-right font-mono text-[12px] tabular-nums text-tv-amber opacity-90">{row.volatility?.toFixed(2)}%</td>}

                                                <td className="py-1.5 px-3 text-right font-mono text-[11px] text-gray-400 tabular-nums opacity-60">
                                                    {formatNum(row.volume)}
                                                </td>
                                                <td className="py-1.5 px-3 text-right font-mono text-[11px] text-gray-400 tabular-nums">
                                                    ${formatNum(row.quoteVolume)}
                                                </td>
                                                <td className="py-1.5 px-2 text-center align-middle">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            window.dispatchEvent(new CustomEvent('nexus:open-alert-creator', { detail: { symbol: row.symbol, price: row.price } }));
                                                            toggleScanner();
                                                        }}
                                                        className="opacity-20 hover:opacity-100 p-1 hover:bg-tv-hover text-tv-amber rounded transition-all select-none float-right"
                                                        title={`Set Alert for ${row.symbol}`}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
