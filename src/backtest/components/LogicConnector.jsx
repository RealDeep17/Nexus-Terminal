import React from 'react';

export default function LogicConnector({ logic, onChange }) {
    return (
        <div className="flex items-center space-x-2 my-2 ml-4 relative">
            <div className="absolute left-[-16px] top-1/2 w-4 h-[1px] bg-border-default"></div>

            <select
                value={logic}
                onChange={(e) => onChange(e.target.value)}
                className="bg-bg-input border border-border-default rounded-[2px] text-[10px] uppercase font-bold text-tv-blue px-1 py-0.5 focus:outline-none focus:border-border-focus"
            >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
            </select>

            <div className="h-[1px] bg-border-default flex-1"></div>
        </div>
    );
}
