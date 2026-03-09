import React from 'react';

// ConditionBlock represents a single atomic rule or a logical group
export default function ConditionBlock({ condition, index, onEdit, onDelete, level = 0 }) {
    const isGroup = condition.logic && condition.items;

    if (isGroup) {
        return (
            <div className={`border-l-2 border-border-default pl-3 ml-${level * 2} my-2`}>
                <div className="flex items-center space-x-2 mb-2">
                    <span className="text-[10px] font-bold text-tv-blue px-1.5 py-0.5 border border-tv-blue/30 bg-tv-blue/10 rounded-[2px] uppercase">
                        {condition.logic}
                    </span>
                    <div className="h-[1px] bg-border-default flex-1"></div>
                </div>

                <div className="flex flex-col space-y-1">
                    {condition.items.map((item, idx) => (
                        <ConditionBlock
                            key={idx}
                            condition={item}
                            index={idx}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            level={level + 1}
                        />
                    ))}
                </div>

                <div className="mt-2 text-[11px] text-text-link hover:underline cursor-pointer">
                    + Add Condition
                </div>
            </div>
        );
    }

    // Atomic condition rendering
    return (
        <div className="group flex items-center justify-between p-2 bg-bg-input border border-border-default rounded-[3px] hover:border-border-focus transition-colors">
            <div className="flex flex-col">
                <span className="text-[12px] font-medium text-text-primary capitalize leading-tight">
                    {condition.type.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] text-text-secondary mt-0.5 leading-tight">
                    {_formatParams(condition.params)}
                </span>
            </div>

            <div className="hidden group-hover:flex items-center space-x-1 pl-2 bg-bg-input">
                <button className="text-text-secondary hover:text-text-primary w-[20px] h-[20px] flex items-center justify-center" onClick={() => onEdit(index)}>✎</button>
                <button className="text-text-secondary hover:text-tv-red w-[20px] h-[20px] flex items-center justify-center" onClick={() => onDelete(index)}>✕</button>
            </div>
        </div>
    );
}

function _formatParams(params) {
    if (!params) return 'No parameters';
    return Object.entries(params).map(([k, v]) => `${k}:${v}`).join(' • ');
}
