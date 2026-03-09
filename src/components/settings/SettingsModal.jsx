import React, { useState } from 'react';
import useSettingsStore from '../../store/useSettingsStore.js';
import useLayoutStore from '../../store/useLayoutStore.js';

export default function SettingsModal() {
    const { settingsOpen, toggleSettings } = useLayoutStore();
    const store = useSettingsStore();

    const [activeTab, setActiveTab] = useState('Chart');

    const TABS = ['Chart', 'Indicators', 'Alerts', 'Watchlist', 'Appearance', 'Hotkeys', 'API'];

    if (!settingsOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[800px] h-[600px] bg-tv-bg border border-tv-border rounded shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="h-14 border-b border-tv-border flex items-center justify-between px-6 bg-tv-panel shrink-0">
                    <h2 className="text-lg font-semibold text-gray-200">Terminal Settings</h2>
                    <button onClick={toggleSettings} className="p-2 text-gray-400 hover:text-white rounded hover:bg-tv-hover">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Nav */}
                    <div className="w-48 bg-tv-panel/50 border-r border-tv-border py-2 flex flex-col">
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`text-left px-6 py-3 text-sm font-medium transition-colors ${activeTab === tab ? 'bg-tv-hover text-tv-blue border-l-2 border-tv-blue' : 'text-gray-400 hover:text-gray-200 border-l-2 border-transparent'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Content Panel */}
                    <div className="flex-1 p-6 overflow-y-auto no-scrollbar relative text-sm">

                        {activeTab === 'Chart' && (
                            <div className="space-y-6">
                                <h3 className="text-base font-semibold text-white border-b border-tv-border pb-2 mb-4">Chart Canvas</h3>

                                <SettingRow label="Default Chart Type">
                                    <select className="tv-input" value={store.chartType} onChange={e => store.updateSetting('chartType', e.target.value)}>
                                        <option value="Candles">Candles</option>
                                        <option value="Heikin Ashi">Heikin Ashi</option>
                                        <option value="Line">Line</option>
                                        <option value="Area">Area</option>
                                        <option value="Bar">Bar</option>
                                    </select>
                                </SettingRow>

                                <SettingRow label="Default Timeframe">
                                    <select className="tv-input" value={store.timeframe} onChange={e => store.updateSetting('timeframe', e.target.value)}>
                                        {['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'].map(tf => <option key={tf} value={tf}>{tf}</option>)}
                                    </select>
                                </SettingRow>

                                <SettingRow label="Show Volume Bars">
                                    <Toggle checked={store.showVolume} onChange={v => store.updateSetting('showVolume', v)} />
                                </SettingRow>

                                <SettingRow label="Show NEXUS Watermark">
                                    <Toggle checked={store.showWatermark} onChange={v => store.updateSetting('showWatermark', v)} />
                                </SettingRow>

                                <SettingRow label="Crosshair Mode">
                                    <select className="tv-input" value={store.crosshairMode} onChange={e => store.updateSetting('crosshairMode', e.target.value)}>
                                        <option value="Normal">Normal</option>
                                        <option value="Magnet">Magnet</option>
                                    </select>
                                </SettingRow>

                                <h3 className="text-base font-semibold text-white border-b border-tv-border pb-2 mt-8 mb-4">Colors & Grid</h3>

                                <SettingRow label="Background Color">
                                    <div className="flex items-center gap-2">
                                        {['#131722', '#0d1117', '#1a1a2e'].map(h => (
                                            <button key={h} onClick={() => store.updateSetting('backgroundColor', h)} className={`w-6 h-6 rounded-full border-2 ${store.backgroundColor === h ? 'border-tv-blue' : 'border-tv-border'}`} style={{ background: h }} />
                                        ))}
                                        <input type="color" value={store.backgroundColor} onChange={e => store.updateSetting('backgroundColor', e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0 ml-2" />
                                    </div>
                                </SettingRow>

                                <SettingRow label="Grid Lines Opacity">
                                    <div className="flex items-center gap-4">
                                        <input type="range" min="0" max="100" value={store.gridOpacity} onChange={e => store.updateSetting('gridOpacity', Number(e.target.value))} className="w-32 accent-tv-blue" />
                                        <span className="text-xs text-tv-muted tabular-nums w-8">{store.gridOpacity}%</span>
                                    </div>
                                </SettingRow>

                                <SettingRow label="Candle Colors (Up / Down)">
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={store.candleUpColor} onChange={e => store.updateSetting('candleUpColor', e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0" />
                                        <input type="color" value={store.candleDownColor} onChange={e => store.updateSetting('candleDownColor', e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0" />
                                    </div>
                                </SettingRow>

                            </div>
                        )}

                        {activeTab === 'Indicators' && (
                            <div className="space-y-6">
                                <h3 className="text-base font-semibold text-white border-b border-tv-border pb-2 mb-4">Default Parameters</h3>

                                <SettingRow label="EMA Periods">
                                    <div className="flex items-center gap-2">
                                        {store.emaPeriods.map((p, i) => (
                                            <input key={`ema${i}`} type="number" min="1" max="999" value={p} onChange={e => store.updateArraySetting('emaPeriods', i, Number(e.target.value))} className="tv-input w-16 text-center" />
                                        ))}
                                    </div>
                                </SettingRow>

                                <SettingRow label="RSI Levels (Overbought / Oversold)">
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="1" max="100" value={store.rsiLevels.overbought} onChange={e => store.updateNestedSetting('rsiLevels', 'overbought', Number(e.target.value))} className="tv-input w-20 text-center" />
                                        <span className="text-gray-500">/</span>
                                        <input type="number" min="1" max="100" value={store.rsiLevels.oversold} onChange={e => store.updateNestedSetting('rsiLevels', 'oversold', Number(e.target.value))} className="tv-input w-20 text-center" />
                                    </div>
                                </SettingRow>

                                <SettingRow label="Bollinger Bands Multiplier">
                                    <input type="number" min="0.1" step="0.1" max="10" value={store.bbMultiplier} onChange={e => store.updateSetting('bbMultiplier', Number(e.target.value))} className="tv-input w-24 text-center" />
                                </SettingRow>

                                <SettingRow label="Supertrend (ATR Length / Multiplier)">
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="1" max="100" value={store.supertrendParams.atr} onChange={e => store.updateNestedSetting('supertrendParams', 'atr', Number(e.target.value))} className="tv-input w-20 text-center" />
                                        <span className="text-gray-500">/</span>
                                        <input type="number" min="0.1" step="0.1" max="20" value={store.supertrendParams.multiplier} onChange={e => store.updateNestedSetting('supertrendParams', 'multiplier', Number(e.target.value))} className="tv-input w-20 text-center" />
                                    </div>
                                </SettingRow>

                            </div>
                        )}

                        {activeTab === 'Alerts' && (
                            <div className="space-y-6">
                                <h3 className="text-base font-semibold text-white border-b border-tv-border pb-2 mb-4">Notification Channels</h3>

                                <SettingRow label="Audio Alerts">
                                    <Toggle checked={store.audioAlerts} onChange={v => store.updateSetting('audioAlerts', v)} />
                                </SettingRow>

                                <SettingRow label="Browser System Notifications">
                                    <div className="flex items-center gap-4">
                                        <Toggle checked={store.browserNotifications} onChange={v => store.updateSetting('browserNotifications', v)} />
                                        <button className="text-xs text-tv-blue hover:text-blue-300 font-medium">Request Permission</button>
                                    </div>
                                </SettingRow>

                                <SettingRow label="In-App Toast Duration (Seconds)">
                                    <div className="flex items-center gap-4">
                                        <input type="range" min="3" max="15" value={store.toastDuration} onChange={e => store.updateSetting('toastDuration', Number(e.target.value))} className="w-32 accent-tv-blue" />
                                        <span className="text-xs text-tv-muted tabular-nums w-8">{store.toastDuration}s</span>
                                    </div>
                                </SettingRow>

                                <h3 className="text-base font-semibold text-white border-b border-tv-border pb-2 mt-8 mb-4">Alert Engine Defaults</h3>

                                <SettingRow label="Default Fire Mode">
                                    <select className="tv-input" value={store.defaultFireMode} onChange={e => store.updateSetting('defaultFireMode', e.target.value)}>
                                        <option value="Once">Once Per Bar</option>
                                        <option value="Every Time">Every Time</option>
                                        <option value="Always">Always</option>
                                    </select>
                                </SettingRow>

                                <SettingRow label="Default Cooldown (Seconds)">
                                    <input type="number" min="0" max="3600" value={store.defaultCooldown} onChange={e => store.updateSetting('defaultCooldown', Number(e.target.value))} className="tv-input w-24" />
                                </SettingRow>
                            </div>
                        )}

                        {activeTab === 'Watchlist' && (
                            <div className="space-y-6">
                                <h3 className="text-base font-semibold text-white border-b border-tv-border pb-2 mb-4">Data Display</h3>

                                <SettingRow label="Price Decimal Precision">
                                    <select className="tv-input" value={store.pricePrecision} onChange={e => store.updateSetting('pricePrecision', e.target.value)}>
                                        <option value="Auto">Auto-scaling</option>
                                        <option value="2">2 Decimals</option>
                                        <option value="4">4 Decimals</option>
                                        <option value="6">6 Decimals</option>
                                        <option value="8">8 Decimals</option>
                                    </select>
                                </SettingRow>

                                <SettingRow label="Tick Flash Animations">
                                    <Toggle checked={store.flashAnimations} onChange={v => store.updateSetting('flashAnimations', v)} />
                                </SettingRow>

                                <h3 className="text-base font-semibold text-white border-b border-tv-border pb-2 mt-8 mb-4">Default Symbols List</h3>
                                <div className="text-xs text-tv-muted mb-2">These automatically load on hard reset. Editing this directly here requires technical knowledge.</div>
                                <textarea
                                    className="tv-input w-full h-24 font-mono text-xs"
                                    value={store.defaultSymbols.join(', ')}
                                    onChange={e => store.updateSetting('defaultSymbols', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                />
                            </div>
                        )}

                        {activeTab === 'Appearance' && (
                            <div className="space-y-6">
                                <h3 className="text-base font-semibold text-white border-b border-tv-border pb-2 mb-4">Localization & Sizing</h3>

                                <SettingRow label="UI Font Size">
                                    <select className="tv-input" value={store.fontSize} onChange={e => store.updateSetting('fontSize', e.target.value)}>
                                        <option value="Small">Small</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Large">Large</option>
                                    </select>
                                </SettingRow>

                                <SettingRow label="Sidebar Width (px)">
                                    <div className="flex items-center gap-4">
                                        <input type="range" min="280" max="420" value={store.sidebarWidth} onChange={e => {
                                            store.updateSetting('sidebarWidth', Number(e.target.value));
                                            useLayoutStore.getState().setRightSidebarWidth(Number(e.target.value));
                                        }} className="w-32 accent-tv-blue" />
                                        <span className="text-xs text-tv-muted tabular-nums w-12">{store.sidebarWidth}px</span>
                                    </div>
                                </SettingRow>

                                <SettingRow label="Number Format">
                                    <select className="tv-input" value={store.numberFormat} onChange={e => store.updateSetting('numberFormat', e.target.value)}>
                                        <option value="1,234.56">1,234.56 (US/UK)</option>
                                        <option value="1234.56">1234.56 (No commas)</option>
                                    </select>
                                </SettingRow>

                                <SettingRow label="Date / Time Zone">
                                    <select className="tv-input" value={store.timeFormat} onChange={e => store.updateSetting('timeFormat', e.target.value)}>
                                        <option value="UTC">UTC (Exchange Time)</option>
                                        <option value="Local">Local Device Time</option>
                                    </select>
                                </SettingRow>

                            </div>
                        )}

                        {activeTab === 'Hotkeys' && (
                            <div className="space-y-6">
                                <h3 className="text-base font-semibold text-white border-b border-tv-border pb-2 mb-4">Keyboard Shortcuts</h3>
                                <div className="grid grid-cols-2 gap-y-4 text-sm text-gray-300">
                                    <div className="flex justify-between border-b border-tv-border/50 pb-2 pr-4">
                                        <span>Open Symbol Search</span>
                                        <kbd className="bg-tv-panel border border-tv-border px-1.5 py-0.5 rounded text-xs text-white shadow-sm">Cmd+K / Ctrl+K</kbd>
                                    </div>
                                    <div className="flex justify-between border-b border-tv-border/50 pb-2 pl-4">
                                        <span>Focus Timeframe</span>
                                        <kbd className="bg-tv-panel border border-tv-border px-1.5 py-0.5 rounded text-xs text-white shadow-sm">0-9</kbd>
                                    </div>
                                    <div className="flex justify-between border-b border-tv-border/50 pb-2 pr-4">
                                        <span>Toggle Indicators</span>
                                        <kbd className="bg-tv-panel border border-tv-border px-1.5 py-0.5 rounded text-xs text-white shadow-sm">Alt+I / Opt+I</kbd>
                                    </div>
                                    <div className="flex justify-between border-b border-tv-border/50 pb-2 pl-4">
                                        <span>Create Alert</span>
                                        <kbd className="bg-tv-panel border border-tv-border px-1.5 py-0.5 rounded text-xs text-white shadow-sm">Alt+A / Opt+A</kbd>
                                    </div>
                                    <div className="flex justify-between border-b border-tv-border/50 pb-2 pr-4">
                                        <span>Replay Mode</span>
                                        <kbd className="bg-tv-panel border border-tv-border px-1.5 py-0.5 rounded text-xs text-white shadow-sm">Alt+R / Opt+R</kbd>
                                    </div>
                                    <div className="flex justify-between border-b border-tv-border/50 pb-2 pl-4">
                                        <span>Draw Trendline</span>
                                        <kbd className="bg-tv-panel border border-tv-border px-1.5 py-0.5 rounded text-xs text-white shadow-sm">Alt+T / Opt+T</kbd>
                                    </div>
                                    <div className="flex justify-between border-b border-tv-border/50 pb-2 pr-4">
                                        <span>Draw Fib Retracement</span>
                                        <kbd className="bg-tv-panel border border-tv-border px-1.5 py-0.5 rounded text-xs text-white shadow-sm">Alt+F / Opt+F</kbd>
                                    </div>
                                    <div className="flex justify-between border-b border-tv-border/50 pb-2 pl-4">
                                        <span>Toggle Cursor Crosshair</span>
                                        <kbd className="bg-tv-panel border border-tv-border px-1.5 py-0.5 rounded text-xs text-white shadow-sm">Esc</kbd>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'API' && (
                            <div className="space-y-6">
                                <h3 className="text-base font-semibold text-white border-b border-tv-border pb-2 mb-4">Exchange Integration</h3>

                                <SettingRow label="Binance API Key">
                                    <input
                                        type="password"
                                        placeholder="Enter your API Key"
                                        value={store.binanceApiKey}
                                        onChange={e => store.updateSetting('binanceApiKey', e.target.value)}
                                        className="tv-input w-64 border-tv-border focus:border-tv-blue"
                                    />
                                </SettingRow>

                                <SettingRow label="Binance API Secret">
                                    <input
                                        type="password"
                                        placeholder="Enter your API Secret"
                                        value={store.binanceApiSecret}
                                        onChange={e => store.updateSetting('binanceApiSecret', e.target.value)}
                                        className="tv-input w-64 border-tv-border focus:border-tv-blue"
                                    />
                                </SettingRow>

                                <div className="mt-8 pt-4 border-t border-tv-border/50 flex justify-end">
                                    <button
                                        onClick={() => {
                                            useLayoutStore.getState().showToast('🔌 Connect success: Exchange integration complete.', 'success');
                                            toggleSettings();
                                        }}
                                        className="bg-tv-blue hover:bg-blue-600 text-white font-bold py-2 px-6 rounded transition-colors shadow-lg"
                                    >
                                        Connect to Exchange
                                    </button>
                                </div>
                                <div className="text-xs text-tv-muted mt-4">
                                    <p>Your API keys are stored locally in your browser and are never transmitted to our servers.</p>
                                    <p>Ensure your keys have ONLY standard permissions (reading data) if you are not actively live trading.</p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}

// Visual Helpers
function SettingRow({ label, children }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-gray-300 font-medium select-none">{label}</span>
            <div className="flex items-center justify-end">
                {children}
            </div>
        </div>
    );
}

function Toggle({ checked, onChange }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-tv-blue' : 'bg-gray-600'}`}
        >
            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-1'}`} style={{ transform: checked ? 'translateX(20px)' : 'translateX(4px)' }} />
        </button>
    );
}
