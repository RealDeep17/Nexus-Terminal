import React from 'react';

export default function RiskConfig({ config, onChange }) {
    if (!config) return null;

    return (
        <div className="flex flex-col space-y-2 bg-bg-input p-2 rounded-[3px] border border-border-default">
            <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-secondary">Position Sizing</span>
                <select
                    value={config.type}
                    onChange={(e) => onChange({ ...config, type: e.target.value })}
                    className="tv-input w-28"
                >
                    <option value="percent_equity">% Equity</option>
                    <option value="fixed_usdt">Fixed USDT</option>
                    <option value="risk_percent">Risk %</option>
                </select>
            </div>

            <div className="flex items-center justify-between mt-1 pt-1 border-t border-border-light">
                <span className="text-[12px] text-text-secondary">Value</span>
                <div className="flex items-center space-x-1">
                    {config.type === 'fixed_usdt' && <span className="text-[12px] text-text-muted">$</span>}
                    <input
                        type="number"
                        className="tv-input w-20 text-right"
                        value={config.value}
                        onChange={(e) => onChange({ ...config, value: Number(e.target.value) })}
                    />
                    {config.type.includes('percent') && <span className="text-[12px] text-text-muted">%</span>}
                </div>
            </div>
        </div>
    );
}
