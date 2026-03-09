import { useEffect, useRef } from 'react';
import useMarketStore from '../store/useMarketStore.js';
import useWatchlistStore from '../store/useWatchlistStore.js';
import { fetchAllTickers } from './binance.js';

export function useWatchlistLiveData() {
    const symbols = useWatchlistStore(state => state.symbols);
    const updatePrice = useMarketStore(state => state.updatePrice);
    const setWsStatus = useMarketStore(state => state.setWsStatus);
    const updateTicker = useMarketStore(state => state.updateTicker);
    const setMultiTfChange = useMarketStore(state => state.setMultiTfChange);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttempts = useRef(0);

    // Initial REST Fetch for all tickers to populate context instantly
    useEffect(() => {
        let mounted = true;
        fetchAllTickers().then(map => {
            if (!mounted) return;
            symbols.forEach(sym => {
                const data = map.get(sym);
                if (data) updateTicker(sym, data);
            });
        });

        // Fast concurrent %-change fetching for watchlist multi-timeframes
        symbols.forEach(sym => {
            const fetchTf = async (tf, limit = 2) => {
                const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${tf}&limit=${limit}`;
                try {
                    const res = await fetch(url);
                    const klines = await res.json();
                    if (klines && klines.length >= 2 && mounted) {
                        const open = parseFloat(klines[0][1]);
                        const close = parseFloat(klines[klines.length - 1][4]);
                        const changePct = ((close - open) / open) * 100;
                        setMultiTfChange(sym, { [tf]: changePct });
                    }
                } catch (err) {
                    // silently fail so it doesn't pollute console
                }
            };
            fetchTf('1h');
            fetchTf('4h');
            fetchTf('1d');
            fetchTf('1w');
        });

        return () => { mounted = false; };
    }, [symbols, updateTicker, setMultiTfChange]);

    // WebSocket Management
    useEffect(() => {
        if (!symbols || symbols.length === 0) return;

        connectWS();

        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };

        function connectWS() {
            setWsStatus('reconnecting');
            const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
            const url = `wss://fstream.binance.com/stream?streams=${streams}`;

            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                setWsStatus('connected');
                reconnectAttempts.current = 0;

                // Ping-pong for latency measurement
                ws.pingInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ method: 'LIST_SUBSCRIPTIONS', id: Date.now() }));
                    }
                }, 5000);
            };

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);

                    // Handle Ping response for latency
                    if (payload.id) {
                        const latency = Date.now() - payload.id;
                        useMarketStore.getState().updateLatency(latency);
                    }

                    const data = payload.data;
                    if (data && data.e === '24hrTicker') {
                        const symbol = data.s;
                        updatePrice(symbol, {
                            price: parseFloat(data.c),
                            change24h: parseFloat(data.P), // Percentage
                            volume24h: parseFloat(data.v),
                            high24h: parseFloat(data.h),
                            low24h: parseFloat(data.l),
                            bestBid: parseFloat(data.b),
                            bestAsk: parseFloat(data.a)
                        });
                    }
                } catch (err) {
                    console.warn("WS Parse error", err);
                }
            };

            ws.onerror = (err) => {
                console.error("Binance WS Error:", err);
            };

            ws.onclose = () => {
                if (ws.pingInterval) clearInterval(ws.pingInterval);
                setWsStatus('disconnected');
                wsRef.current = null;

                // Exponential Backoff
                const maxWait = 30000;
                const waitTime = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxWait);
                reconnectAttempts.current++;

                reconnectTimeoutRef.current = setTimeout(connectWS, waitTime);
            };
        }
    }, [symbols, updatePrice, setWsStatus]); // Re-run if symbols list changes
}
