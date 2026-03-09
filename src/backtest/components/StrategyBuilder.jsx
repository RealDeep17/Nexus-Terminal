import React, { useState } from 'react';
import ConditionEditor from './ConditionEditor';
import useBacktestStore from '../store/useBacktestStore.js';
import usePaperStore from '../store/usePaperStore.js';
import { fetchKlines } from '../../api/binance.js';
import BacktestRunner from '../engine/BacktestRunner.js';
import { StrategyPresets } from '../strategy/StrategyPresets.js';

export default function StrategyBuilder() {
    const { draftStrategy, initDraftFromPreset, updateDraft, setRunning, setResults, isRunning } = useBacktestStore();
    const { isActive: isPaperActive, startPaper, stopPaper, pnl, pnlPct } = usePaperStore();
    const [loading, setLoading] = useState(false);

    const handleRun = async () => {
        if (!draftStrategy || isRunning) return;
        setRunning(true);
        setLoading(true);
        try {
            const sym = draftStrategy.universe?.symbol || 'BTCUSDT';
            const tf = draftStrategy.universe?.timeframe || '15m';
            const bars = await fetchKlines(sym, tf, 1500); // explicit 1500 bars matching UI
            const runner = new BacktestRunner();
            const res = runner.run(draftStrategy, bars);
            setResults(res);
        } catch (e) {
            console.error('Backtest failed:', e);
        } finally {
            setLoading(false);
            setRunning(false);
        }
    };

    const togglePaperTrade = () => {
        if (isPaperActive) {
            stopPaper();
        } else {
            const sym = draftStrategy.universe?.symbol || 'BTCUSDT';
            const tf = draftStrategy.universe?.timeframe || '15m';
            startPaper(draftStrategy, sym, tf, draftStrategy.backtestConfig?.initialCapital || 10000);
        }
    };

    if (!draftStrategy) {
        return (
            <div className="h-full flex flex-col p-4 bg-tv-panel border-l border-tv-border w-[360px] shrink-0 overflow-y-auto">
                <div className="text-[14px] font-semibold text-text-primary mb-4">Select Strategy Preset</div>
                <div className="flex flex-col space-y-3">
                    {StrategyPresets.map(preset => (
                        <div
                            key={preset.id}
                            onClick={() => initDraftFromPreset(preset)}
                            className="bg-bg-input border border-tv-border rounded-[4px] p-3 cursor-pointer hover:border-tv-blue transition-colors group"
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[13px] font-medium text-text-primary group-hover:text-tv-blue">{preset.name}</span>
                                <div className="flex space-x-1">
                                    <span className="text-[9px] text-tv-muted px-1 py-0.5 bg-bg-app rounded">{preset.universe.symbol}</span>
                                    <span className="text-[9px] text-tv-muted px-1 py-0.5 bg-bg-app rounded">{preset.universe.timeframe}</span>
                                </div>
                            </div>
                            <p className="text-[11px] text-tv-muted leading-relaxed">{preset.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const { entryRule, exitRule, backtestConfig } = draftStrategy;

    const GroupHeader = ({ title }) => (
        <div className="text-[11px] uppercase text-tv-muted font-medium tracking-wide mb-2 pt-2 border-t border-tv-border first:border-0 first:pt-0">
            {title}
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-tv-panel border-l border-tv-border w-[360px] shrink-0 overflow-y-auto no-scrollbar pt-2 px-3">

            {/* Strategy Header */}
            <div className="mb-4">
                <input
                    type="text"
                    value={draftStrategy.name || ''}
                    onChange={(e) => updateDraft({ name: e.target.value })}
                    className="w-full bg-transparent text-[16px] font-semibold text-text-primary focus:outline-none focus:border-b focus:border-border-focus"
                    placeholder="Strategy Name"
                />
                <div className="flex space-x-1 mt-1">
                    <span className="text-[10px] text-tv-muted px-1 py-0.5 bg-bg-input rounded-[2px] border border-tv-border">{draftStrategy.universe.symbol}</span>
                    <span className="text-[10px] text-tv-muted px-1 py-0.5 bg-bg-input rounded-[2px] border border-tv-border">{draftStrategy.universe.timeframe}</span>
                </div>
            </div>

            <GroupHeader title="Capital & Risk" />
            <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                    <label className="text-[10px] text-tv-muted block mb-0.5">Initial Capital</label>
                    <div className="flex items-center relative">
                        <span className="text-[12px] text-text-muted absolute left-2">$</span>
                        <input
                            type="number"
                            className="tv-input w-full pl-5"
                            value={backtestConfig.initialCapital}
                            onChange={e => updateDraft({ backtestConfig: { ...backtestConfig, initialCapital: +e.target.value } })}
                        />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] text-tv-muted block mb-0.5">Pos Size (% Equity)</label>
                    <input
                        type="number"
                        className="tv-input w-full"
                        value={entryRule.sizing.value}
                        onChange={e => updateDraft({ entryRule: { ...entryRule, sizing: { ...entryRule.sizing, value: +e.target.value } } })}
                    />
                </div>
            </div>

            <GroupHeader title="Long Entry Rules" />
            <div className="mb-4">
                <ConditionEditor
                    group={entryRule.conditions}
                    onChange={(newConditions) => updateDraft({ entryRule: { ...entryRule, conditions: newConditions } })}
                />
            </div>

            <GroupHeader title="Exit & Stops" />
            <div className="mb-4">
                <ConditionEditor
                    group={exitRule.conditions}
                    onChange={(newConditions) => updateDraft({ exitRule: { ...exitRule, conditions: newConditions } })}
                />
            </div>

            <div className="flex flex-col space-y-2 mb-4">
                <div
                    className="flex items-center justify-between bg-bg-input p-2 rounded-[3px] border border-tv-border cursor-pointer select-none"
                    onClick={() => updateDraft({ exitRule: { ...exitRule, stopLoss: { ...exitRule.stopLoss, enabled: !exitRule.stopLoss.enabled } } })}
                >
                    <div className="flex items-center space-x-2 pointer-events-none">
                        <input type="checkbox" checked={exitRule.stopLoss.enabled} readOnly className="accent-tv-blue" />
                        <span className="text-[12px] text-text-primary">Stop Loss ({exitRule.stopLoss.type.toUpperCase()})</span>
                    </div>
                    <span className="text-[12px] tabular-nums font-medium text-text-primary">{exitRule.stopLoss.value}</span>
                </div>

                <div
                    className="flex items-center justify-between bg-bg-input p-2 rounded-[3px] border border-tv-border cursor-pointer select-none"
                    onClick={() => updateDraft({ exitRule: { ...exitRule, takeProfit: { ...exitRule.takeProfit, enabled: !exitRule.takeProfit.enabled } } })}
                >
                    <div className="flex items-center space-x-2 pointer-events-none">
                        <input type="checkbox" checked={exitRule.takeProfit.enabled} readOnly className="accent-tv-blue" />
                        <span className="text-[12px] text-text-primary">Take Profit ({exitRule.takeProfit.type.toUpperCase()})</span>
                    </div>
                    <span className="text-[12px] tabular-nums font-medium text-text-primary">{exitRule.takeProfit.value || 'N/A'}</span>
                </div>
            </div>

            <div className="flex-1 min-h-[40px]"></div>

            <div className="sticky bottom-0 bg-tv-panel pt-2 pb-3 border-t border-tv-border mt-auto z-10 flex flex-col space-y-2">
                <button
                    onClick={handleRun}
                    disabled={loading || isRunning || isPaperActive}
                    className="w-full tv-button tv-button-primary h-[32px] text-[13px] shadow-[0_2px_8px_rgba(41,98,255,0.2)] disabled:opacity-50"
                >
                    {loading ? 'Running...' : '▶ Run Backtest (1500 bars)'}
                </button>
                <div className="flex items-center justify-between">
                    <button
                        onClick={togglePaperTrade}
                        disabled={loading || isRunning}
                        className={`tv-button h-[32px] text-[13px] flex-1 mr-2 flex justify-center items-center ${isPaperActive ? 'bg-[rgba(38,166,154,0.15)] text-[#26a69a] border border-[rgba(38,166,154,0.3)]' : 'bg-bg-input text-tv-muted border border-tv-border hover:text-text-primary'}`}
                    >
                        {isPaperActive ? '■ Stop Paper' : '▶ Paper Trade'}
                    </button>
                    {isPaperActive && (
                        <div className={`text-[13px] font-medium mr-1 ${pnl >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                            ${pnl.toFixed(2)}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
