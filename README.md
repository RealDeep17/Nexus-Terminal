# Nexus Terminal

Nexus Terminal is a professional-grade trading dashboard and terminal for cryptocurrency markets. It features a high-performance market scanner, real-time charting via Lightweight Charts, a robust backtesting engine, and an automated alert system.

## Key Features

- **Market Scanner**: Track thousands of assets concurrently across multiple timeframes (1m, 5m, 1h).
- **Advanced Charting**: Integrated high-performance charts with multi-timeframe backfills.
- **Backtesting Engine**: Simulate strategies with professional-grade analytics and equity curves.
- **Alert Engine**: Real-time evaluation of price targets and indicator conditions.
- **Paper Trading**: Virtual environment for testing strategies in live market conditions.

## Project Structure

- `src/api`: Binance API integration and data fetching logic.
- `src/backtest`: Core backtesting engine and strategy runner.
- `src/components`: Reusable UI components (Modals, Buttons, Charts, etc.).
- `src/engine`: Alert and alert-notifier logic.
- `src/store`: State management using Zustand.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/RealDeep17/Nexus-Terminal.git
   cd Nexus-Terminal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Development

### Scripts

- `npm run dev`: Starts the Vite development server.
- `npm run build`: Compiles the project for production.
- `npm run preview`: Previews the production build locally.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
