# Polymarket Lens

A small analytics dashboard for Polymarket. I built this to analyze volatility trends across markets using cached queries over historical data.

**Live:** https://acyclops.dev

---

## Features

- Leaderboards for multiple metrics (volatility, chop, momentum, etc.)
- Multiple time windows (1h, 4h, 1d, 7d, 30d)
- Market search
- Per-market time series view

---

## Tech stack

- **Backend:** Node.js + Express
- **Database:** PostgreSQL (Neon)
- **Cache:** Redis
- **Frontend:** React + Vite
- **Hosting:** VPS (DigitalOcean)

---

## How it works (high level)

A data pipeline runs on the VPS and snapshots market data every 15 minutes, cleans it up, and stores it in Postgres. The API queries this data and uses Redis caching to keep responses quick and reduce database load. Time windows are validated server-side to prevent expensive queries. This setup makes it easy to add new leaderboard metrics by simply adding a new SQL query to the backend.

---

## Running locally

### 1. Install dependencies

    git clone <REPO>
    cd <REPO>
    npm install

### 2. Configure environment variables

    cp .env.example .env

Make sure to fill in `DATABASE_URL` with your own.

### 3. Start dependencies

You need:

- PostgreSQL (local or hosted)
- Redis (local or hosted)

### 4. Run in development

    npm run dev

---

## API endpoints

- `GET /api/health` - basic API and database check
- `GET /api/status` - pipeline status
- `GET /api/leaderboards/<type>?window=7%20days` - leaderboard metrics
- `GET /api/markets/search?q=<query>`
- `GET /api/markets/:slug/timeseries?window=7%20days` - time seriese data per market

---

## Future ideas

- Additional leaderboard metrics
- Add filters (volume, liquidity, tags)
