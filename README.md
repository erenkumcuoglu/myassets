# Portfolio Pilot

A local investment portfolio tracker built with Next.js 14, SQLite, and Recharts. Track your investments across multiple asset classes with real-time price fetching, FIFO P&L calculation, and comprehensive analytics.

## Features

- **Multi-Asset Support**: Track BIST stocks, NASDAQ/US stocks, Turkish mutual funds (TEFAS), and commodities
- **Real-Time Price Fetching**: Automatic price updates from Yahoo Finance and TEFAS
- **FIFO P&L Calculation**: Accurate realized and unrealized P&L using First-In-First-Out method
- **Interactive Dashboard**: Visual charts for allocation and top positions
- **Transaction Management**: Log buy/sell transactions with validation
- **Asset Detail Pages**: Deep dive into individual holdings with historical charts
- **CSV Export**: Export transaction history for analysis
- **Responsive Design**: Works seamlessly on desktop and mobile

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite (better-sqlite3)
- **State Management**: Zustand
- **Charts**: Recharts
- **Fonts**: IBM Plex Sans & IBM Plex Mono

## Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

## Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd New project
```

2. **Install dependencies**
```bash
npm install
```

3. **Create the data directory**
```bash
mkdir -p data
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

## Database

The SQLite database file is located at `/data/portfolio.db`. It will be automatically created on first run.

**Important**: The `/data` directory is gitignored to prevent committing your personal portfolio data.

## Seeding Data (Optional)

To populate the database with sample data for testing:

```bash
npm run seed
```

This will add example assets and transactions to help you explore the application.

## Project Structure

```
├── app/
│   ├── dashboard/          # Main dashboard with charts and summary
│   ├── portfolio/          # Portfolio overview and asset detail pages
│   ├── transactions/       # Transaction history with filters
│   ├── add-transaction/    # Form to log new transactions
│   └── api/                # API routes for data fetching
├── components/             # Reusable UI components
├── lib/                    # Core business logic
│   ├── db.ts              # Database operations
│   ├── calculations.ts    # P&L calculations
│   ├── prices.ts          # Price fetching service
│   └── format.ts          # Currency formatting
├── types/                  # TypeScript type definitions
└── data/                   # SQLite database (gitignored)
```

## Asset Classes

- **BIST**: Istanbul Stock Exchange (e.g., GARAN.IS, ISCTR.IS)
- **NASDAQ**: US stocks and ETFs (e.g., MSFT, QQQ, NVDA)
- **FUND_TR**: Turkish mutual funds via TEFAS (e.g., TI2, MAC, HBF)
- **FUND_US**: US mutual funds and ETFs
- **COMMODITY**: Commodities (e.g., XAU=X for gold)

## Price Fetching

The app fetches prices from:
- **Yahoo Finance**: For BIST, NASDAQ, and commodities
- **TEFAS API**: For Turkish mutual funds

If price fetching fails, the app falls back to the last cached price with a warning badge.

## Building for Production

```bash
npm run build
npm start
```

## Railway Deployment

This app is configured for Railway deployment with persistent database storage.

### Deploy to Railway

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect repository on Railway**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

3. **Add a persistent volume**
   - In your Railway project, click "New" → "Volume"
   - Mount path: `/data`
   - This ensures your SQLite database persists across deployments

4. **Set environment variables**
   - Go to your project settings → Variables
   - Add: `NODE_ENV=production`
   - Add: `DATABASE_URL=./data/portfolio.db`

5. **Deploy**
   - Railway will automatically deploy your app
   - The database schema will be auto-created on first run

### Railway Configuration

The `railway.json` file in the project root configures:
- Build using Nixpacks
- Start command: `npm run build && npm start`
- Restart policy: ON_FAILURE

### Database Persistence

The SQLite database is stored at `/data/portfolio.db`. This path is mounted as a persistent volume on Railway, so your data survives deployments and restarts.

## License

MIT
