import { useEffect } from 'react';
import useLayoutStore from '../store/useLayoutStore.js';
import useReplayStore from '../store/useReplayStore.js';
import useChartStore from '../store/useChartStore.js';

export default function useKeyboardShortcuts() {
    useEffect(() => {
        const handler = (e) => {
            // Cmd+K / Ctrl+K → focus symbol search in TopBar
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('nexus:open-symbol-search'));
            }
            // Alt+I → open Indicators tab
            if (e.altKey && e.key === 'i') {
                e.preventDefault();
                useLayoutStore.getState().setRightTab('Indicators');
            }
            // Alt+A → open Alerts tab
            if (e.altKey && e.key === 'a') {
                e.preventDefault();
                useLayoutStore.getState().setRightTab('Alerts');
            }
            // Alt+B or Alt+S → toggle backtest panel
            if (e.altKey && (e.key === 'b' || e.key === 's')) {
                e.preventDefault();
                useLayoutStore.getState().toggleBacktest();
            }
            // Escape → close any open dropdown/modal, cancel replay choosing
            if (e.key === 'Escape') {
                window.dispatchEvent(new CustomEvent('nexus:close-all'));
                useReplayStore.getState().setIsChoosing(false);
            }

            // Ignore keystrokes inside inputs/textareas for single-key shortcuts
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // R → trigger Replay pick mode
            if (e.key === 'r' || e.key === 'R') {
                useReplayStore.getState().setIsChoosing(true);
            }

            // Space → play/pause replay
            if (e.key === ' ' && useReplayStore.getState().isActive) {
                e.preventDefault();
                const s = useReplayStore.getState();
                s.setIsPlaying(!s.isPlaying);
            }

            // Timeframes 1-6
            const tfMap = { '1': '1m', '2': '5m', '3': '15m', '4': '1h', '5': '4h', '6': '1d' };
            if (tfMap[e.key]) {
                useChartStore.getState().setTimeframe(tfMap[e.key]);
            }

            // B → Backtest Panel
            if (e.key === 'b' || e.key === 'B') {
                useLayoutStore.getState().toggleBacktest();
            }

            // / → Scanner
            if (e.key === '/') {
                e.preventDefault();
                useLayoutStore.getState().toggleScanner();
            }
            // Arrow Left/Right → scroll chart 1 bar
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                window.dispatchEvent(new CustomEvent('nexus:chart-scroll', { detail: { dir: e.key === 'ArrowLeft' ? -1 : 1 } }));
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);
}
