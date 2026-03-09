# Nexus Terminal - Comprehensive Project Audit & To-Do List

This report provides a full project audit for the Nexus Terminal, documenting existing bugs, glitches, empty UI states, features that are not working, and a comprehensive "To-Do" checklist for future development.

## 1. Known Bugs & Glitches

### API & Data Fetching
- **CORS Issues:** Most calls to `https://fapi.binance.com` in `src/api/binance.js` (e.g., `fetchTicker24hr`, `fetchKlines`, etc.) may face Cross-Origin Resource Sharing (CORS) errors when run directly from the browser locally without a proxy. This is evident by the `Phase 1 failed` logs in `MainChart.jsx` and `fetchKlinesRange failed`.
- **Unhandled Loading States:** In `TokenScanner.jsx` (the Market Scanner modal), if `init` fails to fetch the 24hr ticker data, the `catch` block sets `loading` to `false` but leaves `data` empty. This results in the UI appearing completely empty with no error message indicating a failure.

### Application State & Workers
- **Data Cross-Contamination & Race Conditions:** From the project context, there is a known issue regarding data cross-contamination where UI state updates for specific rows/elements might be incorrectly applied across different worker datasets. This leads to data corruption during processing.

## 2. Empty UI & Mock Data Placeholders

- **Backtest Equity Curve:** The backtest application tab currently uses hardcoded mock values to populate the `EquityCurveChart.jsx` initially (marked internally as `// Dummy data just for visual setup before run`), which may mislead users before a backtest is officially run.
- **Alert Engine Evaluation:** Inside `AlertEngine.js`, the price target evaluator uses a mock data structure (`const mockClose = 69420;`) as a temporary hack to keep the engine running without fully connecting to live Kline websockets yet.
- **Backtesting Default Output:** If the total bars evaluated is less than or equal to 0, or if there is an error in the iterator, the strategy runner falls back to `_emptyResult()`, returning zeroed-out analytics which might look like an empty UI state natively.

## 3. Features Not (Fully) Working

- **Right Sidebar Indicators Tab:** The UI correctly displays available indicators like EMA, SMA, VWAP, Bollinger Bands, etc., but it requires extensive wiring to ensure these are correctly pushed into the lightweight-charts instance and visually rendered out.
- **Alerts Triggering System:** While `AlertNotifier.js` exists, the overall flow of evaluating thousands of assets concurrently against condition sets (MACD, RSI, etc.) depends solely on dummy data right now, meaning alerts won't reliably fire on real conditions.
- **Scanner 1m/5m/1h Changes:** The lazy loading of multi-timeframe backfills on the scanner list limits to 50 assets. Rapidly scrolling or searching might cancel or leak those fetch promises yielding `...` placeholders indefinitely for some tokens.

---

## 4. Comprehensive To-Do / Bug Fix Checklist

### High Priority (Critical Bug Fixes)
- [ ] **Fix Binance API CORS:** Implement a local proxy configuration in `vite.config.js` to route `/fapi` requests through the Vite dev server to bypass browser CORS restrictions.
- [ ] **Data Cross-Contamination Fix:** Ensure worker threads and the Rust backend properly isolate dataset indices. Prevent shared UI row state ID collisions when rendering updates.
- [ ] **Scanner Error Handling:** Update `TokenScanner.jsx` to render an explicit `<ErrorMessage />` component or a "Retry" button when `data.length === 0` and an API error is caught.
- [ ] **Chart Phase 1 Fix:** Investigate `Phase 1 failed` inside `MainChart.jsx` via `binance.js` — likely solved by the CORS fix, but ensure robust request timeouts.

### Medium Priority (Feature Completion)
- [ ] **Wire Real Data for Alerts:** Remove `mockClose = 69420` from `AlertEngine.js` and hook it into the global `useMarketStore` live price feeds to perform real-time evaluations.
- [ ] **Dynamic Backtesting Chart:** Remove the dummy data from `EquityCurveChart.jsx`. Render a blank state (or descriptive prompt) until the user explicitly runs a simulation.
- [ ] **Indicators Rendering Logic:** Guarantee that clicking an indicator in the Right Sidebar (e.g., VWAP or Supertrend) correctly translates to overlay plugins in `lightweight-charts`.

### Low Priority (UX & Glitches)
- [ ] **Scanner Pagination/Optimization:** Instead of a `timeout` interval fetching 50 tokens at a time, use an `IntersectionObserver` on the scanner rows to only fetch multi-timeframe sparklines/percent changes precisely for what is visible.
- [ ] **Batch Alert Creation:** Ensure the "Alert Top N" batch processor respects API rate limits to prevent Binance IP bans when creating hundreds of alerts simultaneously.
- [ ] **Settings Persistence:** Expand `localStorage` usage beyond just columns (e.g., saving selected indicators, default chart timeframes, and chart aesthetics across reloads).

## 5. Potential Features to Add
1. **Trade Execution Integration:** Transition the "Paper Trading" module into a live CCXT or Binance API connector for executing real trades directly from the terminal.
2. **Strategy Exporting:** Add the ability in the Backtester to export configuration and conditions as JSON or easily shareable URLs.
3. **Advanced Chart Tools:** Integrate drawing tools (Fibonacci retracement, trend channels) natively within the chart bounds.
