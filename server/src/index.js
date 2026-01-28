import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { query } from "./db.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { withCache } from "./lib/cache.js";
import { 
  SQL_ABS_RANGE,
  SQL_VOLATILITY_STDDEV,
  SQL_VOLATILITY_WHIPLASH,
  SQL_VOLATILITY_CHOP,
  SQL_VOLATILITY_MOMENTUM,
  SQL_VOLATILITY_SMART_MONEY,
  SQL_VOLATILITY_STABILITY
} from "./sql/leaderboards.js";

// Constants

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
  "https://acyclops.dev",
  "https://www.acyclops.dev",
  process.env.CLIENT_ORIGIN,
].filter(Boolean));

// Restrict intervals so we know what to expect and nothing insane like 365d comes through
const ALLOWED_WINDOWS = new Set(["1 hour", "4 hours", "1 day", "7 days", "30 days"]);

const CACHE_TTL_SECONDS = 120;

// Helpers

function getWindow(req) {
  const w = req.query.window ?? "7 days";
  return ALLOWED_WINDOWS.has(w) ? w : "7 days";
}

function leaderboardRoute(type, sql) {
  return async (req, res) => {
    const window = getWindow(req);
    try {
      const rows = await withCache(`leaderboard:v1:${type}:${window}`, CACHE_TTL_SECONDS, async () => {
        const { rows } = await query(sql, [window]);
        return rows;
      });
      res.json({ type, window, rows });
    } catch (e) {
      console.error(`leaderboard ${type} failed`, e.message);
      res.status(500).json({ error: "leaderboard_failed" });
    }
  };
}

// Config + Middleware setup

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "200kb" }));
app.use("/api", apiLimiter);

app.disable("x-powered-by");

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      if (allowedOrigins.has(origin)) {
        return cb(null, true);
      }

      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: false,
  })
);

// Health + status

app.get("/api/health", async (req, res) => {
  try {
    const result = await query("select now() as now");
    res.json({ ok: true, dbTime: result.rows[0].now });
  } catch (e) {
    console.error("health check failed", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/status", async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT * FROM pipeline_status WHERE pipeline_name = $1",
      ["polymarket_pipeline"]
    );
    res.json(rows[0] ?? null);
  } catch (e) {
    console.error("status failed", e.message);
    res.status(500).json({ error: "status_failed" });
  }
});

// Leaderboards

app.get("/api/leaderboards/abs_change", leaderboardRoute("abs_change", SQL_ABS_RANGE));
app.get("/api/leaderboards/whiplash", leaderboardRoute("whiplash", SQL_VOLATILITY_WHIPLASH));
app.get("/api/leaderboards/stddev", leaderboardRoute("stddev", SQL_VOLATILITY_STDDEV));
app.get("/api/leaderboards/chop", leaderboardRoute("chop", SQL_VOLATILITY_CHOP));
app.get("/api/leaderboards/momentum", leaderboardRoute("momentum", SQL_VOLATILITY_MOMENTUM));
app.get("/api/leaderboards/smart_money", leaderboardRoute("smart_money", SQL_VOLATILITY_SMART_MONEY));
app.get("/api/leaderboards/stability", leaderboardRoute("stability", SQL_VOLATILITY_STABILITY));

// Markets

app.get("/api/markets/:slug/timeseries", async (req, res) => {
  const { slug } = req.params;
  const window = getWindow(req);

  const sql = `
    SELECT
      t.ts,
      t.probability,
      t.volume24hr,
      t.liquidity
    FROM market_ticks t
    JOIN markets m ON m.market_id = t.market_id
    WHERE m.slug = $1
      AND t.ts >= now() - ($2::interval)
    ORDER BY t.ts;
  `;

  try {
    const rows = await withCache(
      `timeseries:v1:${slug}:${window}`,
      CACHE_TTL_SECONDS,
      async () => {
        const { rows } = await query(sql, [slug, window]);
        return rows;
      }
    );
    res.json(rows);
  } catch (e) {
    console.error("timeseries failed", e.message);
    res.status(500).json({ error: "timeseries_failed" });
  }
});

// Not caching results here, too many possible inputs/typos
// Required pg_trgm extension in DB to use similarity()
app.get("/api/markets/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json([]);

  const limit = Math.min(
    Math.max(parseInt(req.query.limit ?? "12", 10), 1),
    200 // capped at 200
  );

  const sql = `
    SELECT market_id, question, slug
    FROM markets
    WHERE question ILIKE '%' || $1 || '%'
    ORDER BY
      similarity(question, $1) DESC,
      question
    LIMIT $2;
  `;

  try {
    const { rows } = await query(sql, [q, limit]);
    res.json(rows);
  } catch (e) {
    console.error("search failed", e.message);
    res.status(500).json({ error: "search_failed" });
  }
});

// Error handler

app.use((err, req, res, next) => {
  if (String(err?.message ?? "").startsWith("CORS blocked")) {
    return res.status(403).json({ error: "cors_blocked" });
  }
  console.error("[api] error:", err);
  res.status(500).json({ error: "internal_error" });
});

// Start server

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
