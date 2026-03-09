import React from 'react';

const INDICATORS = [
    { id: 'close', label: 'Price (Close)' },
    { id: 'ema_20', label: 'EMA 20' },
    { id: 'ema_50', label: 'EMA 50' },
    { id: 'ema_200', label: 'EMA 200' },
    { id: 'rsi_14', label: 'RSI 14' },
    { id: 'macd.macd_line', label: 'MACD Line' },
    { id: 'macd.signal_line', label: 'MACD Signal' },
    { id: 'macd.histogram', label: 'MACD Hist' },
    { id: 'bb_20.upper', label: 'BB Upper' },
    { id: 'bb_20.lower', label: 'BB Lower' },
    { id: 'atr_14', label: 'ATR 14' }
];

const OPERATORS = [
    { id: 'c_up', label: 'Crosses Above ↑' },
    { id: 'c_down', label: 'Crosses Below ↓' },
    { id: '>', label: 'Greater Than >' },
    { id: '<', label: 'Less Than <' },
    { id: '==', label: 'Equals ==' },
    { id: 'rising', label: 'Is Rising ↗' },
    { id: 'falling', label: 'Is Falling ↘' }
];

export default function ConditionEditor({ group, onChange }) {
    if (!group) group = { logic: 'AND', items: [] };

    const handleLogicChange = (e) => onChange({ ...group, logic: e.target.value });

    const addItem = () => {
        onChange({
            ...group,
            items: [...(group.items || []), { type: 'INDICATOR_VALUE_THRESHOLD', params: { indicatorId: 'rsi_14', operator: '>', threshold: 70 } }]
        });
    };

    const updateItem = (index, newItem) => {
        const newItems = [...(group.items || [])];
        newItems[index] = newItem;
        onChange({ ...group, items: newItems });
    };

    const removeItem = (index) => {
        const newItems = [...(group.items || [])];
        newItems.splice(index, 1);
        onChange({ ...group, items: newItems });
    };

    return (
        <div className="flex flex-col gap-2 bg-bg-app border border-tv-border rounded p-3">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-tv-muted uppercase font-bold tracking-wider">Match</span>
                <select value={group.logic || 'AND'} onChange={handleLogicChange} className="tv-input text-[11px] py-1 px-2 w-20 text-center font-bold text-tv-blue">
                    <option value="AND">ALL</option>
                    <option value="OR">ANY</option>
                </select>
                <span className="text-[10px] text-tv-muted uppercase font-bold tracking-wider">of the following rules:</span>
            </div>

            <div className="flex flex-col gap-2 relative pl-4 border-l-2 border-tv-border/50 ml-1">
                {group.items?.map((item, idx) => (
                    <ConditionRow key={idx} item={item} onChange={(newItem) => updateItem(idx, newItem)} onRemove={() => removeItem(idx)} />
                ))}

                <button onClick={addItem} className="text-[11px] text-tv-blue hover:text-blue-400 font-bold self-start flex items-center gap-1.5 py-1.5 px-2 bg-tv-blue/10 hover:bg-tv-blue/20 rounded transition-colors mt-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                    Add Condition
                </button>
            </div>
        </div>
    );
}

function ConditionRow({ item, onChange, onRemove }) {
    let left = 'close';
    let op = '>';
    let rightType = 'value';
    let rightVal = 0;

    if (item.type === 'INDICATOR_VALUE_THRESHOLD') {
        left = item.params.indicatorId;
        op = item.params.operator;
        rightType = 'value';
        rightVal = item.params.threshold;
    } else if (item.type === 'INDICATOR_CROSS_INDICATOR') {
        left = item.params.indicatorA;
        op = item.params.direction === 'cross_above' ? 'c_up' : 'c_down';
        rightType = 'indicator';
        rightVal = item.params.indicatorB;
    } else if (item.type === 'INDICATOR_CROSS_PRICE') {
        left = item.params.indicatorId;
        op = item.params.direction === 'cross_above' ? 'c_up' : 'c_down';
        rightType = 'indicator';
        rightVal = 'close';
    } else if (item.type === 'PRICE_CROSSES_UP') {
        left = 'close'; op = 'c_up'; rightType = 'value'; rightVal = item.params.value;
    } else if (item.type === 'PRICE_CROSSES_DOWN') {
        left = 'close'; op = 'c_down'; rightType = 'value'; rightVal = item.params.value;
    } else if (item.type === 'PRICE_ABOVE') {
        left = 'close'; op = '>'; rightType = 'value'; rightVal = item.params.value;
    } else if (item.type === 'PRICE_BELOW') {
        left = 'close'; op = '<'; rightType = 'value'; rightVal = item.params.value;
    } else if (item.type === 'INDICATOR_SLOPE') {
        left = item.params.indicatorId; op = item.params.direction; rightType = 'none';
    }

    const handleChange = (newLeft, newOp, newRightType, newRightVal) => {
        let newType = 'INDICATOR_VALUE_THRESHOLD';
        let newParams = {};

        if (newOp === 'rising' || newOp === 'falling') {
            newType = 'INDICATOR_SLOPE';
            newParams = { indicatorId: newLeft, direction: newOp };
        } else if (newLeft === 'close') {
            if (newRightType === 'value') {
                if (newOp === 'c_up') { newType = 'PRICE_CROSSES_UP'; newParams = { value: Number(newRightVal) }; }
                else if (newOp === 'c_down') { newType = 'PRICE_CROSSES_DOWN'; newParams = { value: Number(newRightVal) }; }
                else if (newOp === '>') { newType = 'PRICE_ABOVE'; newParams = { value: Number(newRightVal) }; }
                else if (newOp === '<') { newType = 'PRICE_BELOW'; newParams = { value: Number(newRightVal) }; }
                else { newType = 'PRICE_ABOVE'; newParams = { value: Number(newRightVal) }; }
            } else {
                newType = 'INDICATOR_CROSS_PRICE';
                newParams = { indicatorId: newRightVal, direction: newOp === 'c_up' ? 'cross_below' : 'cross_above' };
            }
        } else {
            if (newRightType === 'indicator') {
                if (newRightVal === 'close') {
                    newType = 'INDICATOR_CROSS_PRICE';
                    newParams = { indicatorId: newLeft, direction: newOp === 'c_up' ? 'cross_above' : 'cross_below' };
                } else {
                    newType = 'INDICATOR_CROSS_INDICATOR';
                    newParams = { indicatorA: newLeft, indicatorB: newRightVal, direction: newOp === 'c_up' ? 'cross_above' : 'cross_below' };
                }
            } else {
                newType = 'INDICATOR_VALUE_THRESHOLD';
                newParams = { indicatorId: newLeft, operator: newOp, threshold: Number(newRightVal) };
            }
        }
        onChange({ type: newType, params: newParams });
    };

    return (
        <div className="flex items-center gap-1.5 bg-bg-input border border-tv-border rounded p-1.5 shadow-sm group">
            <select className="tv-input text-[11px] py-1 pl-2 pr-1 w-[90px] font-medium" value={left} onChange={e => handleChange(e.target.value, op, rightType, rightVal)}>
                {INDICATORS.map(ind => <option key={ind.id} value={ind.id}>{ind.label}</option>)}
            </select>

            <select className="tv-input text-[10px] py-1 pl-1 pr-1 w-[80px]" value={op} onChange={e => handleChange(left, e.target.value, rightType, rightVal)}>
                {OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>

            {op !== 'rising' && op !== 'falling' ? (
                <div className="flex flex-1 items-center gap-1">
                    <div className="flex border border-tv-border rounded overflow-hidden shadow-inner bg-tv-bg">
                        <button onClick={() => handleChange(left, op, 'value', 0)} className={`px-1.5 py-1 text-[9px] font-bold ${rightType === 'value' ? 'bg-tv-blue text-white' : 'text-gray-500 hover:text-gray-300'}`}>#</button>
                        <button onClick={() => handleChange(left, op, 'indicator', 'ema_20')} className={`px-1.5 py-1 text-[9px] font-bold ${rightType === 'indicator' ? 'bg-tv-blue text-white' : 'text-gray-500 hover:text-gray-300'}`}>IND</button>
                    </div>
                    {rightType === 'value' ? (
                        <input type="number" className="tv-input text-[11px] py-1 w-[54px] pl-1" value={rightVal !== undefined ? rightVal : ''} onChange={e => handleChange(left, op, rightType, e.target.value)} />
                    ) : (
                        <select className="tv-input text-[11px] py-1 w-full pl-1" value={rightVal} onChange={e => handleChange(left, op, rightType, e.target.value)}>
                            {INDICATORS.map(ind => <option key={ind.id} value={ind.id}>{ind.label}</option>)}
                        </select>
                    )}
                </div>
            ) : (
                <div className="flex-1"></div>
            )}

            <button onClick={onRemove} className="text-gray-500 hover:text-tv-red w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-tv-bg border border-tv-border rounded">
                ✕
            </button>
        </div>
    );
}
