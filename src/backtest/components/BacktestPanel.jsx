import React, { useState, useCallback, useRef } from 'react';
import StrategyBuilder from './StrategyBuilder';
import MetricsDashboard from './MetricsDashboard';
import TradeTable from './TradeTable';
import EquityCurveChart from './EquityCurveChart';
import MonteCarloChart from './MonteCarloChart';
import WalkForwardChart from './WalkForwardChart';
import OptimizationHeatmap from './OptimizationHeatmap';
import useBacktestStore from '../store/useBacktestStore.js';
import useLayoutStore from '../../store/useLayoutStore.js';
import usePaperStore from '../store/usePaperStore.js';

export default function BacktestPanel() {
    const [activeTab, setActiveTab] = useState('equity');
    const { lastResult } = useBacktestStore();
    const { backtestPanelHeight, setBacktestPanelHeight } = useLayoutStore();
    const { isActive: isPaperActive, position, trades, pnl, pnlPct } = usePaperStore();
    const dragRef = useRef(null);

    const handleResizeStart = useCallback((e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startH = backtestPanelHeight || 350;
        const onMove = (ev) => {
            const delta = startY - ev.clientY;
            setBacktestPanelHeight(Math.max(200, Math.min(800, startH + delta)));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [backtestPanelHeight, setBacktestPanelHeight]);

    const tabs = [
        { id: 'equity', label: 'Equity Curve' },
        { id: 'metrics', label: 'Performance Summary' },
        { id: 'trades', label: 'List of Trades' },
        { id: 'monte', label: 'Monte Carlo' },
        { id: 'walkforward', label: 'Walk-Forward' },
        { id: 'optimize', label: 'Optimize' },
    ];

    if (isPaperActive) {
        tabs.push({ id: 'paper', label: 'Paper Trade' });
    }

    return (
        <div style={{ height: backtestPanelHeight || 350 }} className="flex flex-col w-full border-t border-tv-border bg-tv-panel shrink-0 select-none">
            {/* Resize Handle */}
            <div
                onMouseDown={handleResizeStart}
                className="h-[4px] w-full cursor-ns-resize bg-transparent hover:bg-tv-blue/30 transition-colors shrink-0"
            />
            <div className="flex flex-1 min-h-0">
                <StrategyBuilder />

                <div className="flex-1 flex flex-col border-l border-tv-border min-w-0">
                    <div className="h-[36px] flex items-center px-4 border-b border-tv-border shrink-0 space-x-6 overflow-x-auto no-scrollbar">
                        {tabs.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                className={`text-[13px] font-medium h-full flex items-center relative transition-colors whitespace-nowrap ${activeTab === t.id ? 'text-tv-blue' : 'text-tv-muted hover:text-text-primary'
                                    }`}
                            >
                                {t.label}
                                {activeTab === t.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-tv-blue"></div>
                                )}
                            </button>
                        ))}

                        <div className="flex-1"></div>

                        <div className="flex items-center space-x-4 text-[12px] shrink-0">
                            <span className="text-tv-muted">Net Profit: <span className={`${(lastResult?.summary?.netProfitPct || 0) >= 0 ? 'text-tv-green' : 'text-tv-red'} font-medium tabular-nums ml-1`}>{(lastResult?.summary?.netProfitPct || 0).toFixed(2)}%</span></span>
                            <span className="text-tv-muted">Win Rate: <span className="text-text-primary font-medium tabular-nums ml-1">{(lastResult?.summary?.winRate || 0).toFixed(1)}%</span></span>
                            <span className="text-tv-muted"># Trades: <span className="text-text-primary font-medium tabular-nums ml-1">{lastResult?.summary?.totalTrades || 0}</span></span>

                            {lastResult?.trades && lastResult.trades.length > 0 && (
                                <button
                                    onClick={() => {
                                        import('../../store/useJournalStore.js').then(module => {
                                            module.default.getState().importFromBacktest(lastResult.trades);
                                            useLayoutStore.getState().showToast('✅ Imported trades to Journal.', 'success');
                                        });
                                    }}
                                    className="bg-tv-blue hover:bg-blue-600 text-white px-3 py-1.5 rounded transition-colors font-bold shadow-md transform hover:scale-105"
                                >
                                    Import to Journal
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 bg-bg-chart relative">
                        {activeTab === 'equity' && <EquityCurveChart />}
                        {activeTab === 'metrics' && <MetricsDashboard />}
                        {activeTab === 'trades' && <TradeTable />}
                        {activeTab === 'monte' && <MonteCarloChart />}
                        {activeTab === 'walkforward' && <WalkForwardChart windows={lastResult?.walkForward} />}
                        {activeTab === 'optimize' && <OptimizationHeatmap optimizationResults={lastResult?.optimization} />}
                        {activeTab === 'paper' && (
                            <div className="flex flex-col h-full bg-tv-panel text-text-primary overflow-y-auto w-full p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[300px]">
                                    <div className="flex flex-col border border-tv-border rounded">
                                        <div className="p-2 border-b border-tv-border text-[12px] font-medium bg-bg-input">Live Equity Curve</div>
                                        <div className="flex-1 relative"><EquityCurveChart isPaper={true} /></div>
                                    </div>
                                    <div className="flex flex-col space-y-4">
                                        <div className="border border-tv-border rounded p-3 bg-bg-input">
                                            <div className="text-[12px] font-medium text-tv-muted mb-2 uppercase">Active Position</div>
                                            {position ? (
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center space-x-2">
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${position.dir === 'long' ? 'bg-[rgba(38,166,154,0.15)] text-[#26a69a]' : 'bg-[rgba(239,83,80,0.15)] text-[#ef5350]'}`}>{position.dir.toUpperCase()}</span>
                                                        <span className="font-medium">{(position.qty).toFixed(4)} @ ${position.entryPrice.toFixed(2)}</span>
                                                    </div>
                                                    <div className={`font-medium ${position.currentPnl >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                                                        ${(position.currentPnl || 0).toFixed(2)} ({(position.currentPnlPct || 0).toFixed(2)}%)
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-[13px] text-tv-muted">No active position</div>
                                            )}
                                        </div>
                                        <div className="border border-tv-border rounded flex-1 flex flex-col">
                                            <div className="p-2 border-b border-tv-border text-[12px] font-medium bg-bg-input">Live Trades</div>
                                            <div className="flex-1 relative overflow-hidden"><TradeTable isPaper={true} /></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
