import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useAlertStore from '../../engine/alerts/useAlertStore.js';
import useWatchlistStore from '../../store/useWatchlistStore.js';
import useMarketStore from '../../store/useMarketStore.js';

const TABS = ['PRICE', 'EMA CROSS', 'RSI', 'MACD', '% MOVE', 'BB TOUCH', 'VOL SPIKE'];

export default function AlertCreatorModal({ onClose, prefilledPrice }) {
    const symbols = useWatchlistStore(s => s.symbols);
    const prices = useMarketStore(s => s.prices);
    const addAlert = useAlertStore(s => s.addAlert);

    const [activeTab, setActiveTab] = useState('PRICE');
    const [symbol, setSymbol] = useState(symbols[0] || 'BTCUSDT');
    const [fireMode, setFireMode] = useState('every_time'); // once | every_time | always
    const [cooldown, setCooldown] = useState(60);

    // Form states
    const [priceCond, setPriceCond] = useState('>=');
    const [priceTarget, setPriceTarget] = useState('');

    const [emaCrossCond, setEmaCrossCond] = useState('cross_above');
    const [emaTarget, setEmaTarget] = useState('ema_50');
    const [emaVsEma, setEmaVsEma] = useState(false);
    const [emaA, setEmaA] = useState('ema_21');
    const [emaB, setEmaB] = useState('ema_50');

    const [rsiPeriod, setRsiPeriod] = useState(14);
    const [rsiCond, setRsiCond] = useState('enters_overbought');
    const [rsiLevel, setRsiLevel] = useState(70);

    const [macdFast, setMacdFast] = useState(12);
    const [macdSlow, setMacdSlow] = useState(26);
    const [macdSignal, setMacdSignal] = useState(9);
    const [macdCond, setMacdCond] = useState('macd_crosses_signal_bullish');

    const [movePct, setMovePct] = useState(5);
    const [moveMins, setMoveMins] = useState(15);
    const [moveDir, setMoveDir] = useState('any');

    // BB & Vol
    const [bbCond, setBbCond] = useState('touches_upper');
    const [volSpikeMins, setVolSpikeMins] = useState(5);
    const [volMulti, setVolMulti] = useState(3);

    // Default price target on mount or symbol change
    useEffect(() => {
        if (prefilledPrice) {
            setPriceTarget(prefilledPrice.toString());
        } else if (prices[symbol]?.price && !priceTarget) {
            setPriceTarget(prices[symbol].price.toString());
        }
    }, [symbol, prices, priceTarget, prefilledPrice]);

    const handleCreate = () => {
        const targets = symbol === 'ALL_WATCHLIST' ? symbols : [symbol];

        targets.forEach(sym => {
            const base = {
                symbol: sym,
                fireMode,
                cooldownMs: cooldown * 1000,
            };

            if (activeTab === 'PRICE') {
                addAlert({
                    ...base,
                    name: `${sym} ${priceCond} $${priceTarget}`,
                    type: 'PRICE_TARGET',
                    params: { operator: priceCond, targetPrice: parseFloat(priceTarget) }
                });
            }
            else if (activeTab === 'EMA CROSS') {
                if (emaVsEma) {
                    addAlert({
                        ...base,
                        name: `${sym} ${emaA} × ${emaB} ${emaCrossCond}`,
                        type: 'EMA_CROSSES_EMA',
                        params: { emaA, emaB, direction: emaCrossCond }
                    });
                } else {
                    addAlert({
                        ...base,
                        name: `${sym} Price × ${emaTarget} ${emaCrossCond}`,
                        type: 'PRICE_CROSSES_EMA',
                        params: { emaKey: emaTarget, direction: emaCrossCond }
                    });
                }
            }
            else if (activeTab === 'RSI') {
                addAlert({
                    ...base,
                    name: `${sym} RSI(${rsiPeriod}) ${rsiCond}`,
                    type: 'RSI_LEVEL',
                    params: { rsiKey: `rsi_${rsiPeriod}`, condition: rsiCond, level: parseFloat(rsiLevel) }
                });
            }
            else if (activeTab === 'MACD') {
                const dir = macdCond.includes('bullish') ? 'Bullish' : 'Bearish';
                const type = macdCond.includes('signal') ? 'MACD x Signal' : 'MACD x Zero';
                addAlert({
                    ...base,
                    name: `${sym} ${type} (${dir})`,
                    type: 'MACD_CROSS',
                    params: { macdKey: 'macd', condition: macdCond }
                });
            }
            else if (activeTab === '% MOVE') {
                addAlert({
                    ...base,
                    name: `${sym} Move ${movePct}% in ${moveMins}m`,
                    type: 'PRICE_MOVE_PCT',
                    params: { minutes: parseInt(moveMins), threshold: parseFloat(movePct), direction: moveDir }
                });
            }
            else if (activeTab === 'BB TOUCH') {
                const side = bbCond.includes('upper') ? 'Upper' : bbCond.includes('lower') ? 'Lower' : 'Basis';
                addAlert({
                    ...base,
                    name: `${sym} BB ${side} Touch`,
                    type: 'BB_TOUCH',
                    params: { condition: bbCond, bbKey: 'bb' }
                });
            }
            else if (activeTab === 'VOL SPIKE') {
                addAlert({
                    ...base,
                    name: `${sym} Vol ${volMulti}x (${volSpikeMins}m)`,
                    type: 'VOLUME_SPIKE',
                    params: { multiplier: parseFloat(volMulti), minutes: parseInt(volSpikeMins) }
                });
            }
        });

        onClose();
    };

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
            <div className="bg-tv-panel border border-tv-border rounded shadow-xl w-[480px] max-w-full flex flex-col text-gray-200 overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-tv-border">
                    <h2 className="font-bold text-base">Create Alert</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>

                {/* Body Tabs */}
                <div className="flex border-b border-tv-border bg-[#131722] overflow-x-auto no-scrollbar">
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 text-xs font-semibold whitespace-nowrap ${activeTab === tab ? 'text-tv-blue border-b-2 border-tv-blue' : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Form Content */}
                <div className="p-5 flex-1 overflow-y-auto" style={{ maxHeight: '60vh' }}>
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-400 mb-1">Symbol</label>
                        <select className="tv-input w-full" value={symbol} onChange={e => setSymbol(e.target.value)}>
                            <option value="ALL_WATCHLIST">ALL WATCHLIST SYMBOLS</option>
                            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {activeTab === 'PRICE' && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Condition</label>
                                    <select className="tv-input w-full" value={priceCond} onChange={e => setPriceCond(e.target.value)}>
                                        <option value=">=">Crosses Above</option>
                                        <option value="<=">Crosses Below</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Price</label>
                                    <input
                                        type="number" step="any" className="tv-input w-full"
                                        value={priceTarget} onChange={e => setPriceTarget(e.target.value)}
                                    />
                                    <div className="text-[10px] text-gray-500 mt-1">Current: {symbol === 'ALL_WATCHLIST' ? 'Multiple' : (prices[symbol]?.price || '—')}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'EMA CROSS' && (
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 cursor-pointer text-xs mb-2">
                                <input type="checkbox" checked={emaVsEma} onChange={e => setEmaVsEma(e.target.checked)} className="accent-tv-blue" />
                                Indicator vs Indicator (EMA vs EMA)
                            </label>

                            {!emaVsEma ? (
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Price Crosses</label>
                                        <select className="tv-input w-full" value={emaTarget} onChange={e => setEmaTarget(e.target.value)}>
                                            <option value="ema_21">EMA 21</option>
                                            <option value="ema_50">EMA 50</option>
                                            <option value="ema_100">EMA 100</option>
                                            <option value="ema_200">EMA 200</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Direction</label>
                                        <select className="tv-input w-full" value={emaCrossCond} onChange={e => setEmaCrossCond(e.target.value)}>
                                            <option value="cross_above">Above</option>
                                            <option value="cross_below">Below</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-400 mb-1">EMA 1</label>
                                            <select className="tv-input w-full" value={emaA} onChange={e => setEmaA(e.target.value)}>
                                                <option value="ema_21">EMA 21</option><option value="ema_50">EMA 50</option><option value="ema_100">EMA 100</option>
                                            </select>
                                        </div>
                                        <span className="text-gray-500 pb-2">crosses</span>
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-400 mb-1">EMA 2</label>
                                            <select className="tv-input w-full" value={emaB} onChange={e => setEmaB(e.target.value)}>
                                                <option value="ema_50">EMA 50</option><option value="ema_100">EMA 100</option><option value="ema_200">EMA 200</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Direction</label>
                                        <select className="tv-input w-[50%]" value={emaCrossCond} onChange={e => setEmaCrossCond(e.target.value)}>
                                            <option value="cross_above">Above (Bullish)</option>
                                            <option value="cross_below">Below (Bearish)</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => { setEmaA('ema_50'); setEmaB('ema_200'); setEmaCrossCond('cross_above'); }}
                                        className="text-xs text-tv-blue hover:underline"
                                    >Preset: Golden Cross (50x200)</button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'RSI' && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <div className="w-1/3">
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Period</label>
                                    <input type="number" className="tv-input w-full" value={rsiPeriod} onChange={e => setRsiPeriod(e.target.value)} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Condition</label>
                                    <select className="tv-input w-full" value={rsiCond} onChange={e => setRsiCond(e.target.value)}>
                                        <option value="enters_overbought">Enters Overbought (&gt; Level)</option>
                                        <option value="exits_oversold">Exits Oversold (&gt; Level)</option>
                                        <option value="cross_above">Crosses Above</option>
                                        <option value="cross_below">Crosses Below</option>
                                    </select>
                                </div>
                                <div className="w-1/3">
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Level</label>
                                    <input type="number" className="tv-input w-full" value={rsiLevel} onChange={e => setRsiLevel(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'MACD' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                <div><label className="block text-xs text-gray-400 mb-1">Fast</label><input type="number" className="tv-input w-full" value={macdFast} onChange={e => setMacdFast(e.target.value)} /></div>
                                <div><label className="block text-xs text-gray-400 mb-1">Slow</label><input type="number" className="tv-input w-full" value={macdSlow} onChange={e => setMacdSlow(e.target.value)} /></div>
                                <div><label className="block text-xs text-gray-400 mb-1">Signal</label><input type="number" className="tv-input w-full" value={macdSignal} onChange={e => setMacdSignal(e.target.value)} /></div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Condition</label>
                                <select className="tv-input w-full" value={macdCond} onChange={e => setMacdCond(e.target.value)}>
                                    <option value="macd_crosses_signal_bullish">MACD crosses Signal (Bullish)</option>
                                    <option value="macd_crosses_signal_bearish">MACD crosses Signal (Bearish)</option>
                                    <option value="macd_crosses_zero_bullish">MACD crosses Zero (Bullish)</option>
                                    <option value="macd_crosses_zero_bearish">MACD crosses Zero (Bearish)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === '% MOVE' && (
                        <div className="space-y-4">
                            <div className="flex gap-2 items-center">
                                <span className="text-sm">Price moves </span>
                                <input type="number" className="tv-input w-20 text-center" value={movePct} onChange={e => setMovePct(e.target.value)} />
                                <span className="text-sm"> % in </span>
                                <input type="number" className="tv-input w-20 text-center" value={moveMins} onChange={e => setMoveMins(e.target.value)} />
                                <span className="text-sm"> mins</span>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-1 text-sm"><input type="radio" name="movedir" checked={moveDir === 'any'} onChange={() => setMoveDir('any')} /> Any</label>
                                <label className="flex items-center gap-1 text-sm"><input type="radio" name="movedir" checked={moveDir === 'up'} onChange={() => setMoveDir('up')} /> Up</label>
                                <label className="flex items-center gap-1 text-sm"><input type="radio" name="movedir" checked={moveDir === 'down'} onChange={() => setMoveDir('down')} /> Down</label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'BB TOUCH' && (
                        <div className="space-y-4">
                            <label className="block text-xs font-medium text-gray-400 mb-1">Condition</label>
                            <select className="tv-input w-full" value={bbCond} onChange={e => setBbCond(e.target.value)}>
                                <option value="touches_upper">Touches Upper Band</option>
                                <option value="touches_lower">Touches Lower Band</option>
                                <option value="crosses_basis">Crosses Basis (Mid)</option>
                            </select>
                            <div className="text-[10px] text-gray-500 mt-1">Triggers when price hits the configured Bollinger Bands limits.</div>
                        </div>
                    )}

                    {activeTab === 'VOL SPIKE' && (
                        <div className="space-y-4">
                            <div className="flex gap-2 items-center">
                                <span className="text-sm whitespace-nowrap">Volume is</span>
                                <input type="number" className="tv-input w-16 text-center" value={volMulti} onChange={e => setVolMulti(e.target.value)} />
                                <span className="text-sm whitespace-nowrap">x higher than average over</span>
                                <input type="number" className="tv-input w-16 text-center" value={volSpikeMins} onChange={e => setVolSpikeMins(e.target.value)} />
                                <span className="text-sm whitespace-nowrap">mins</span>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 border-t border-tv-border pt-4">
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Fire Mode</label>
                        <div className="flex gap-6 mb-3">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" checked={fireMode === 'once'} onChange={() => setFireMode('once')} className="accent-tv-blue" /> Once
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" checked={fireMode === 'every_time'} onChange={() => setFireMode('every_time')} className="accent-tv-blue" /> Every Time
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" checked={fireMode === 'always'} onChange={() => setFireMode('always')} className="accent-tv-blue" /> Always
                            </label>
                        </div>
                        {fireMode === 'every_time' && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Cooldown (seconds):</span>
                                <input type="number" className="tv-input w-20 px-2 py-1" value={cooldown} onChange={e => setCooldown(e.target.value)} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-tv-border bg-tv-bg flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded">Cancel</button>
                    <button onClick={handleCreate} className="px-5 py-2 text-sm font-medium bg-[#2962ff] hover:bg-[#1e53e5] text-white rounded">Create Alert</button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
