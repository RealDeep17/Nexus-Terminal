import React, { useState, useEffect, useRef } from 'react';
import useChartStore from '../../store/useChartStore.js';
import useMarketStore from '../../store/useMarketStore.js';
import { fetchExchangeInfo } from '../../api/binance.js';

export default function SymbolSearch({ isOpen, onClose }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [allSymbols, setAllSymbols] = useState([]);
    const [recentSearches, setRecentSearches] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('nexus_recent_symbols')) || [];
        } catch { return []; }
    });
    const setSymbol = useChartStore(s => s.setSymbol);
    const prices = useMarketStore(s => s.prices);
    const inputRef = useRef(null);

    // Hardcoded trending for visual appeal
    const trending = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        let mounted = true;
        fetchExchangeInfo().then(info => {
            if (mounted && info && info.length > 0) {
                setAllSymbols(info.map(i => i.symbol));
            }
        });
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSelect = (sym) => {
        setSymbol(sym);
        const newRecents = [sym, ...recentSearches.filter(s => s !== sym)].slice(0, 10);
        setRecentSearches(newRecents);
        localStorage.setItem('nexus_recent_symbols', JSON.stringify(newRecents));
        onClose();
    };

    const filtered = searchQuery
        ? allSymbols.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 50)
        : [];

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-[600px] bg-tv-panel border border-tv-border rounded-xl shadow-2xl flex flex-col overflow-hidden text-text-primary"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Input */}
                <div className="flex items-center px-4 h-14 border-b border-tv-border bg-tv-bg">
                    <span className="text-tv-muted mr-3">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent border-none outline-none text-[16px] placeholder:text-tv-muted"
                        placeholder="Search markets (e.g. BTCUSDT, DOGE...)"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    <div className="px-2 py-1 bg-bg-input border border-tv-border rounded text-[10px] text-tv-muted ml-3">ESC</div>
                </div>

                <div className="flex bg-tv-panel h-[400px]">
                    {/* Left Sidebar (Categories) */}
                    <div className="w-[140px] border-r border-tv-border flex flex-col p-2 space-y-1 shrink-0 bg-tv-bg">
                        <div className="px-3 py-1.5 text-[12px] font-medium text-text-primary bg-bg-input rounded cursor-default">All Sources</div>
                        <div className="px-3 py-1.5 text-[12px] font-medium text-tv-muted hover:text-text-primary cursor-pointer">Crypto</div>
                        <div className="px-3 py-1.5 text-[12px] font-medium text-tv-muted hover:text-text-primary cursor-pointer">Indices</div>
                        <div className="px-3 py-1.5 text-[12px] font-medium text-tv-muted hover:text-text-primary cursor-pointer">Forex</div>
                    </div>

                    {/* Right Results Area */}
                    <div className="flex-1 overflow-y-auto no-scrollbar p-2">
                        {searchQuery ? (
                            <div className="flex flex-col">
                                <div className="text-[11px] font-semibold text-tv-muted uppercase px-3 py-2">Search Results</div>
                                {filtered.length === 0 ? (
                                    <div className="p-4 text-center text-tv-muted text-[13px]">No symbols matched "{searchQuery}"</div>
                                ) : (
                                    filtered.map(sym => {
                                        const pd = prices[sym];
                                        return (
                                            <div
                                                key={sym}
                                                onClick={() => handleSelect(sym)}
                                                className="flex items-center justify-between px-3 py-2 hover:bg-tv-hover rounded cursor-pointer group"
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-6 h-6 rounded-full bg-tv-blue/20 text-tv-blue flex items-center justify-center text-xs">₿</div>
                                                    <span className="text-[14px] font-medium text-text-primary">{sym}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {pd && (
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-[12px] font-medium font-mono tabular-nums">{pd.price.toFixed(4)}</span>
                                                            <span className={`text-[11px] font-medium px-1 rounded ${pd.change24h >= 0 ? 'bg-[rgba(38,166,154,0.15)] text-[#26a69a]' : 'bg-[rgba(239,83,80,0.15)] text-[#ef5350]'}`}>
                                                                {pd.change24h >= 0 ? '+' : ''}{pd.change24h.toFixed(2)}%
                                                            </span>
                                                        </div>
                                                    )}
                                                    <span className="text-[12px] text-tv-muted opacity-0 group-hover:opacity-100">BINANCE</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col space-y-4">
                                {recentSearches.length > 0 && (
                                    <div className="flex flex-col">
                                        <div className="text-[11px] font-semibold text-tv-muted uppercase px-3 py-2">Recent Searches</div>
                                        <div className="flex flex-wrap px-3 gap-2">
                                            {recentSearches.map(sym => (
                                                <div
                                                    key={sym}
                                                    onClick={() => handleSelect(sym)}
                                                    className="px-3 py-1.5 bg-bg-input border border-tv-border rounded text-[12px] hover:border-tv-blue hover:text-tv-blue cursor-pointer transition-colors"
                                                >
                                                    {sym}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <div className="text-[11px] font-semibold text-tv-muted uppercase px-3 pt-2 pb-1">Trending Markets</div>
                                    {trending.map(sym => {
                                        const pd = prices[sym];
                                        return (
                                            <div
                                                key={sym}
                                                onClick={() => handleSelect(sym)}
                                                className="flex items-center justify-between px-3 py-2 hover:bg-tv-hover rounded cursor-pointer group"
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-6 h-6 rounded-full bg-tv-blue/20 text-tv-blue flex items-center justify-center text-xs">₿</div>
                                                    <span className="text-[14px] font-medium text-text-primary">{sym}</span>
                                                </div>
                                                <div className="flex space-x-3 items-center">
                                                    {pd && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[12px] font-medium font-mono tabular-nums">{pd.price.toFixed(4)}</span>
                                                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${pd.change24h >= 0 ? 'bg-[rgba(38,166,154,0.15)] text-[#26a69a]' : 'bg-[rgba(239,83,80,0.15)] text-[#ef5350]'}`}>
                                                                {pd.change24h >= 0 ? '+' : ''}{pd.change24h.toFixed(2)}%
                                                            </span>
                                                        </div>
                                                    )}
                                                    <span className="text-[12px] text-tv-muted">BINANCE</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
