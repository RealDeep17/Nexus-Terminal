import React, { useEffect } from 'react';
import useReplayStore from '../../store/useReplayStore.js';

export default function ReplayController() {
    const {
        isActive, isChoosingStartNode, isPlaying, speed,
        klines, currentIndex,
        togglePlay, setSpeed, stepForward, stepBack, stopReplay, setIsChoosing
    } = useReplayStore();

    // Auto-playback loop
    useEffect(() => {
        let intervalId;
        if (isPlaying && isActive) {
            intervalId = setInterval(() => {
                useReplayStore.getState().stepForward();
            }, speed);
        }
        return () => clearInterval(intervalId);
    }, [isPlaying, isActive, speed]);

    if (!isActive && !isChoosingStartNode) return null;

    if (isChoosingStartNode) {
        return (
            <div className="absolute top-0 left-0 right-0 h-[44px] z-50 bg-tv-panel border-b border-tv-border flex items-center justify-center pointer-events-auto">
                <div className="flex items-center gap-6">
                    <span className="text-tv-blue text-sm font-semibold animate-pulse flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                        Click any candle to start replay from that point
                    </span>
                    <button
                        onClick={() => setIsChoosing(false)}
                        className="text-gray-400 hover:text-white transition-colors text-sm font-bold flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 py-1 rounded"
                    >
                        ✕ Cancel
                    </button>
                </div>
            </div>
        );
    }

    const currentData = klines[currentIndex];
    const datetimeStr = currentData?.time
        ? (() => {
            const dt = new Date(currentData.time * 1000);
            const pad = n => String(n).padStart(2, '0');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${pad(dt.getUTCDate())} ${months[dt.getUTCMonth()]} ${dt.getUTCFullYear()} ${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`;
        })()
        : '';

    return (
        <div className="absolute top-0 left-0 right-0 h-[44px] z-[55] bg-tv-panel border-b border-tv-border flex items-center gap-2 px-3 pointer-events-auto shadow-md">

            {/* Controls */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-tv-hover text-gray-300 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    onClick={() => { if (!isPlaying) stepBack(); }}
                    title="Step Back (1 bar)"
                    disabled={isPlaying || currentIndex === 0}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>

                <button
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-tv-hover text-tv-blue transition-colors"
                    onClick={togglePlay}
                >
                    {isPlaying ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    )}
                </button>

                <button
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-tv-hover text-gray-300 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    onClick={() => { if (!isPlaying) stepForward(); }}
                    title="Step Forward (1 bar)"
                    disabled={isPlaying || currentIndex >= klines.length - 1}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                </button>
            </div>

            <div className="text-tv-muted select-none">|</div>

            {/* Datetime */}
            <div className="font-mono text-[11px] text-gray-300 w-[140px] text-center shrink-0">
                {datetimeStr}
            </div>

            <div className="text-tv-muted select-none">|</div>

            {/* Scrubber */}
            <input
                type="range"
                min={0}
                max={klines.length > 0 ? klines.length - 1 : 0}
                value={currentIndex}
                onChange={(e) => {
                    if (isPlaying) togglePlay();
                    useReplayStore.setState({ currentIndex: Number(e.target.value) });
                }}
                className="flex-1 min-w-[100px] accent-tv-blue cursor-pointer"
            />

            <div className="text-tv-muted select-none pl-2">|</div>

            {/* Speed selection */}
            <div className="flex items-center gap-0.5 shrink-0 bg-black/20 p-1 rounded">
                {[
                    { label: '1x', val: 1000 },
                    { label: '2x', val: 500 },
                    { label: '5x', val: 200 },
                    { label: '10x', val: 100 }
                ].map(s => (
                    <button
                        key={s.label}
                        onClick={() => setSpeed(s.val)}
                        className={`text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors ${speed === s.val ? 'bg-tv-blue text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <div className="text-tv-muted select-none pl-2">|</div>

            {/* Exit Button */}
            <button
                onClick={stopReplay}
                className="flex items-center gap-1 text-tv-red hover:text-red-300 transition-colors text-xs font-bold px-3 py-1.5 shrink-0 rounded hover:bg-red-500/10 ml-1"
                title="Exit Replay"
            >
                ✕ Exit
            </button>
        </div>
    );
}
