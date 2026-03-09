import React from 'react';

export default function OrderConfig({ order, onChange }) {
    if (!order) return null;

    return (
        <div className="flex items-center space-x-2 bg-bg-input p-2 rounded-[3px] border border-border-default">
            <span className="text-[12px] text-text-secondary w-16">Entry Type</span>
            <select
                value={order.type}
                onChange={(e) => onChange({ ...order, type: e.target.value })}
                className="tv-input flex-1"
            >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
            </select>

            {order.type !== 'market' && (
                <div className="flex items-center space-x-1">
                    <span className="text-[10px] text-text-muted">Offset %</span>
                    <input
                        type="number"
                        className="tv-input w-16"
                        value={order.limitOffset || 0}
                        onChange={(e) => onChange({ ...order, limitOffset: Number(e.target.value) })}
                    />
                </div>
            )}
        </div>
    );
}
