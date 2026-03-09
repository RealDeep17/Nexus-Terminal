import React, { useState } from 'react';

// Exact TV Left Toolbar hit areas: 28x28px, 18px icons
// Toolbars use #787b86 for secondary unselected, #2a2e39 for hover bg.

const Icons = {
    Cursor: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M5.5 2v13.5l3.5-3.5 3 4 1-1-3-4h4.5L5.5 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>,
    TrendLine: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="4" cy="14" r="1.5" stroke="currentColor" strokeWidth="1.2" /><circle cx="14" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 13.5L13.5 4.5" stroke="currentColor" strokeWidth="1.2" /></svg>,
    Fib: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 4h12M3 8h12M3 14h12M6 2v14M12 2v14" stroke="currentColor" strokeWidth="1.2" /></svg>,
    HLine: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 9h14" stroke="currentColor" strokeWidth="1.5" /></svg>,
    Rect: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="4" width="12" height="10" stroke="currentColor" strokeWidth="1.2" rx="1" /></svg>,
    Text: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 5V3h12v2M9 3v12M7 15h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    Measure: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 3v12M14 3v12M3 5h2M3 9h2M3 13h2M13 5h2M13 9h2M13 13h2M5 9h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    Zoom: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.2" /><path d="M11.5 11.5L15 15M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>,
    Magnet: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M5 8V5a4 4 0 0 1 8 0v3M5 8h2v2H5V8zm6 0h2v2h-2V8z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    Trash: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M6 5v10h6V5H6zM4 5h10M7.5 3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

const ToolBtn = ({ icon: Icon, active, hasMenu }) => (
    <div className="relative group flex justify-center w-full mb-1">
        <button
            className={`w-[28px] h-[28px] rounded-[3px] flex items-center justify-center transition-colors duration-150 ${active ? 'bg-tv-blue-dim text-tv-blue' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
        >
            <Icon />
            {hasMenu && (
                <svg className="absolute right-0 bottom-0 text-text-muted opacity-0 group-hover:opacity-100" width="5" height="5" viewBox="0 0 5 5">
                    <path d="M1 1L4 4V1H1Z" fill="currentColor" />
                </svg>
            )}
        </button>
    </div>
);

const Divider = () => <div className="h-[1px] w-[28px] bg-border-default mx-auto my-1"></div>;

export default function LeftToolbar() {
    const [activeTool, setActiveTool] = useState('cursor');

    const selectTool = (tool) => {
        setActiveTool(tool);
        window.dispatchEvent(new CustomEvent('nexus:drawing-tool-change', { detail: { tool } }));
    };

    const clearAll = () => {
        setActiveTool('cursor');
        window.dispatchEvent(new CustomEvent('nexus:clear-drawings'));
        window.dispatchEvent(new CustomEvent('nexus:drawing-tool-change', { detail: { tool: 'cursor' } }));
    };

    return (
        <div className="w-[49px] bg-bg-panel border-r border-border-default h-full flex flex-col items-center py-2 shrink-0 select-none overflow-y-auto overflow-x-hidden no-scrollbar">

            <div onClick={() => selectTool('cursor')}><ToolBtn icon={Icons.Cursor} active={activeTool === 'cursor'} hasMenu={true} /></div>

            <Divider />

            <div onClick={() => selectTool('trendline')}><ToolBtn icon={Icons.TrendLine} active={activeTool === 'trendline'} hasMenu={true} /></div>
            <div onClick={() => selectTool('hline')}><ToolBtn icon={Icons.HLine} active={activeTool === 'hline'} hasMenu={true} /></div>
            <div onClick={() => selectTool('fib')}><ToolBtn icon={Icons.Fib} active={activeTool === 'fib'} hasMenu={true} /></div>
            <div onClick={() => selectTool('rect')}><ToolBtn icon={Icons.Rect} active={activeTool === 'rect'} hasMenu={true} /></div>
            <div onClick={() => selectTool('text')}><ToolBtn icon={Icons.Text} active={activeTool === 'text'} hasMenu={true} /></div>

            <Divider />

            <div onClick={() => selectTool('measure')}><ToolBtn icon={Icons.Measure} active={activeTool === 'measure'} /></div>
            <div onClick={() => selectTool('zoom')}><ToolBtn icon={Icons.Zoom} active={activeTool === 'zoom'} /></div>

            <div className="flex-1 min-h-[50px]"></div>

            <div onClick={() => selectTool('magnet')}><ToolBtn icon={Icons.Magnet} active={activeTool === 'magnet'} hasMenu={true} /></div>
            <Divider />

            <button onClick={clearAll} className="w-[28px] h-[28px] rounded-[3px] flex items-center justify-center text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors mt-1 mb-2">
                <Icons.Trash />
            </button>

        </div>
    );
}
