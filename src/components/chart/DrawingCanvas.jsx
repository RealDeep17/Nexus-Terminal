import React, { useEffect, useRef, useState, useCallback } from 'react';
import useDrawingStore from '../../store/useDrawingStore.js';
import useChartStore from '../../store/useChartStore.js';

export default function DrawingCanvas({ chart, series, tool, onToolDone }) {
    const canvasRef = useRef(null);
    const { activeSymbol } = useChartStore();
    const { drawings, addDrawing, activeDrawingId, setActiveDrawing } = useDrawingStore();

    // The drawing currently being created
    const [draft, setDraft] = useState(null);
    const isDrawingMode = tool && tool !== 'cursor' && tool !== 'measure';

    // ─────────────────────────────────────────────────────────────────────────
    // Render loop synced to Lightweight Charts and Window
    // ─────────────────────────────────────────────────────────────────────────
    const renderDrawings = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !chart || !series) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
        }

        ctx.clearRect(0, 0, width, height);

        const timeScale = chart.timeScale();
        const activeDrawings = drawings.filter(d => d.symbol === activeSymbol);

        const toCoords = (point) => {
            const x = timeScale.timeToCoordinate(point.time);
            const y = series.priceToCoordinate(point.price);
            return { x, y };
        };

        const drawShape = (d, isDraft = false) => {
            if (!d.points || d.points.length === 0) return;
            const pts = d.points.map(toCoords).filter(p => p.x !== null && p.y !== null);
            if (pts.length === 0) return;

            ctx.save();
            ctx.strokeStyle = d.styles?.color || '#2962ff';
            ctx.lineWidth = d.styles?.lineWidth || 2;
            if (isDraft) ctx.setLineDash([5, 5]);

            if (d.type === 'hline') {
                const y = pts[0].y;
                if (y !== null) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();
                }
            } else if (d.type === 'trendline' && pts.length === 2) {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                ctx.lineTo(pts[1].x, pts[1].y);
                ctx.stroke();
            } else if (d.type === 'rect' && pts.length === 2) {
                ctx.fillStyle = (d.styles?.color || '#2962ff') + '33'; // 20% opacity
                const x = Math.min(pts[0].x, pts[1].x);
                const y = Math.min(pts[0].y, pts[1].y);
                const w = Math.abs(pts[1].x - pts[0].x);
                const h = Math.abs(pts[1].y - pts[0].y);
                ctx.fillRect(x, y, w, h);
                ctx.strokeRect(x, y, w, h);
            } else if (d.type === 'fib' && pts.length === 2) {
                // Drawing 0, 23.6, 38.2, 50, 61.8, 78.6, 100
                const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
                const y0 = pts[0].y;
                const y1 = pts[1].y;
                const minX = Math.min(pts[0].x, pts[1].x);
                const maxX = Math.max(pts[0].x, pts[1].x) + 100; // extend right

                levels.forEach(lvl => {
                    const y = y0 + (y1 - y0) * lvl;
                    ctx.beginPath();
                    ctx.moveTo(minX, y);
                    ctx.lineTo(maxX, y);
                    // Match tradingview default fib colors roughly
                    ctx.strokeStyle = lvl === 0.618 ? '#eab308' : (lvl === 0.5 ? '#22c55e' : ctx.strokeStyle);
                    ctx.stroke();

                    // text
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.font = '10px sans-serif';
                    ctx.fillText(`${lvl} (${d.points[0].price + (d.points[1].price - d.points[0].price) * lvl})`, maxX + 5, y + 4);
                });

                // Draw trendline
                ctx.beginPath();
                ctx.setLineDash([2, 4]);
                ctx.moveTo(pts[0].x, pts[0].y);
                ctx.lineTo(pts[1].x, pts[1].y);
                ctx.stroke();
            } else if (d.type === 'text' && pts.length === 1 && d.text) {
                ctx.fillStyle = d.styles?.color || '#ffffff';
                ctx.font = '14px sans-serif';
                ctx.fillText(d.text, pts[0].x, pts[0].y);
            }

            // Draw anchor points if active or draft
            if ((d.id === activeDrawingId || isDraft) && d.type !== 'hline') {
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#2962ff';
                ctx.lineWidth = 1;
                ctx.setLineDash([]);
                pts.forEach(p => {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                });
            }

            ctx.restore();
        };

        activeDrawings.forEach(d => drawShape(d));
        if (draft) drawShape(draft, true);

    }, [chart, series, drawings, draft, activeSymbol, activeDrawingId]);

    // Redraw on animation frame to sync tightly with LWCharts
    useEffect(() => {
        let frameId;
        const tick = () => {
            renderDrawings();
            frameId = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(frameId);
    }, [renderDrawings]);

    // Resize observer for canvas
    useEffect(() => {
        if (!canvasRef.current || !chart) return;
        const ro = new ResizeObserver(() => renderDrawings());
        ro.observe(canvasRef.current.parentElement);
        return () => ro.disconnect();
    }, [chart, renderDrawings]);

    // ─────────────────────────────────────────────────────────────────────────
    // Interaction Handlers (Mousedowns, Drags, Clicks)
    // ─────────────────────────────────────────────────────────────────────────
    const handlePointerDown = (e) => {
        if (!isDrawingMode || !chart || !series) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const timeScale = chart.timeScale();
        const time = timeScale.coordinateToTime(x);
        const price = series.coordinateToPrice(y);
        if (!time || price === null) return;

        if (tool === 'hline') {
            // 1-click tool
            addDrawing({ symbol: activeSymbol, type: 'hline', points: [{ time, price }] });
            onToolDone();
        } else if (tool === 'text') {
            // 1-click tool with prompt
            const text = window.prompt('Enter text:');
            if (text) {
                addDrawing({ symbol: activeSymbol, type: 'text', text, points: [{ time, price }] });
            }
            onToolDone();
        } else {
            // 2-click tools (trendline, fib, rect)
            if (!draft) {
                // First click
                setDraft({
                    symbol: activeSymbol,
                    type: tool,
                    points: [{ time, price }, { time, price }] // Initialize with 2 identical points
                });
            } else {
                // Second click
                addDrawing({
                    symbol: activeSymbol,
                    type: tool,
                    points: [draft.points[0], { time, price }]
                });
                setDraft(null);
                onToolDone(); // reset to cursor
            }
        }
    };

    const handlePointerMove = (e) => {
        if (!draft || !chart || !series) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const time = chart.timeScale().coordinateToTime(x);
        const price = series.coordinateToPrice(y);
        if (!time || price === null) return;

        setDraft(prev => ({
            ...prev,
            points: [prev.points[0], { time, price }]
        }));
    };

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-40 outline-none"
            style={{
                // Only capture pointer events when a tool is active so LWCharts pans normally otherwise
                pointerEvents: isDrawingMode ? 'auto' : 'none',
                cursor: isDrawingMode ? 'crosshair' : 'default'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            // Cancel draft on right click
            onContextMenu={(e) => {
                if (draft) {
                    e.preventDefault();
                    setDraft(null);
                    onToolDone();
                }
            }}
        />
    );
}
