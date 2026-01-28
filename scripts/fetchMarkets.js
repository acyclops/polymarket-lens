import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "..");

const MASTER_PATH = path.join(PROJECT_ROOT, "data/markets_master.json");

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const EVENTS_PATH = "/events";

const LIMIT = 20;
const VOLUME_MIN = 100_000;

// General helpers

function roundDownTo15Min(d = new Date()) {
  const ms = d.getTime();
  const bucketMs = 15 * 60 * 1000;
  const rounded = Math.floor(ms / bucketMs) * bucketMs;
  return new Date(rounded).toISOString();
}

function loadMasterMarkets() {
  if (!fs.existsSync(MASTER_PATH)) return [];
  try {
    const raw = fs.readFileSync(MASTER_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.markets) ? parsed.markets : [];
  } catch {
    return [];
  }
}

const toMs = (s) => {
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : 0;
};

// Data cleaning helpers

function pickSnapshotFields(m, ts) {
  return {
    marketId: m.marketId,
    ts, // 15 min buckets
    probability: m.currentProbability ?? null,
    volume24hr: m.currentVolume24hr ?? m.volume24hr ?? null,
    liquidity: m.currentLiquidity ?? m.liquidity ?? null,
  };
}

function upsertMasterMarkets(incoming) {
  const existing = loadMasterMarkets();

  const map = new Map();

  // load existing master markets list
  for (const m of existing) {
    if (m?.marketId) map.set(m.marketId, m);
  }

  // upsert new markets data
  for (const m of incoming) {
    if (!m?.marketId) continue;

    const prev = map.get(m.marketId);
    if (!prev) {
      map.set(m.marketId, m);
      continue;
    }

    const prevUpdated = toMs(prev.updatedAt);
    const currUpdated = toMs(m.updatedAt);

    if (currUpdated > prevUpdated) {
      map.set(m.marketId, { ...prev, ...m });
    } else {
      map.set(m.marketId, { ...m, ...prev });
    }
  }

  return [...map.values()];
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return null;

  const s = value.trim();
  if (!s.startsWith("[") || !s.endsWith("]")) return null;

  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractProbabilityFromMarket(m) {
  const outcomes = parseJsonArray(m.outcomes) ?? [];
  const pricesRaw = parseJsonArray(m.outcomePrices) ?? [];

  const prices = pricesRaw.map((x) => Number(x));
  if (prices.length === 0) return null;

  const yesIndex = outcomes.findIndex(
    (o) => String(o).toLowerCase() === "yes"
  );

  const idx = yesIndex !== -1 ? yesIndex : 0;
  const p = prices[idx];

  return Number.isFinite(p) ? p : null;
}

function flattenEventsToMarkets(events) {
  const rows = [];

  for (const e of events) {
    const eventId = String(e.id ?? "");
    const eventTitle = e.title ?? null;
    const eventSlug = e.slug ?? null;

    const tagSlugs = Array.isArray(e.tags)
      ? e.tags.map((t) => t?.slug).filter(Boolean)
      : [];

    // Filter out sports events. these tend to be focused on games
    if (tagSlugs.includes("sports")) continue;

    const markets = Array.isArray(e.markets) ? e.markets : [];

    for (const m of markets) {
      const marketId = String(m.id ?? "");

      // Filter out markets with no ID
      if (!marketId) continue;
      // Filter out inactive or closed markets
      if (!m.active || m.closed) continue;

      const probability = extractProbabilityFromMarket(m);
      const prob = Number(probability);

      rows.push({
        // IDs
        marketId,
        eventId,

        question: m.question ?? null,

        // money info
        currentVolume: Number(m.volumeNum ?? m.volume ?? 0) || 0,
        currentVolume24hr: Number(m.volume24hr ?? 0) || 0,
        currentProbability: Number.isFinite(prob) ? prob : null,
        currentLiquidity: Number(m.liquidity ?? 0) || 0,

        // time + state
        active: Boolean(m.active),
        closed: Boolean(m.closed),
        createdAt: m.createdAt ?? null,
        startDate: m.startDate ?? null,
        endDate: m.endDate ?? null,
        updatedAt: m.updatedAt ?? null,

        // Used for filtering
        tags: tagSlugs,

        // Used for link names
        slug: m.slug ?? eventSlug,
        eventSlug,
        eventTitle,
        icon: m.icon ?? null,
      });
    }
  }

  return rows;
}

// Extra safety, gamma API likely won't return duplicate records
// also protects against duplicates caused by paginating API
function dedupeByMarketId(markets) {
  const map = new Map();

  for (const m of markets) {
    if (!m?.marketId) continue;

    const prev = map.get(m.marketId);
    // continue if no duplicate exists
    if (!prev) {
      map.set(m.marketId, m);
      continue;
    }

    const prevUpdated = toMs(prev.updatedAt);
    const currUpdated = toMs(m.updatedAt);

    // Merge freshest data into market object
    const merged = currUpdated > prevUpdated
      ? { ...prev, ...m }
      : { ...m, ...prev };

    map.set(m.marketId, merged);
  }

  return [...map.values()];
}

// Save functions

function saveMasterMarkets(markets) {
  const dataDir = path.join(PROJECT_ROOT, "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  fs.writeFileSync(
    MASTER_PATH,
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        volumeMin: VOLUME_MIN,
        count: markets.length,
        markets: markets,
      },
      null,
      2
    )
  );

  console.log(`[fetchMarkets] Upserted markets: ${markets.length}`);
  return markets.length;
}

function saveSnapshots(masterMarkets) {
  const dataDir = path.join(PROJECT_ROOT, "data", "snapshots");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const ts = roundDownTo15Min(new Date());
  const filePath = path.join(dataDir, `snapshots_${ts.replace(/[:.]/g, "-")}.json`);

  // Create snapshot from full market data
  const incoming = masterMarkets
    .map((m) => pickSnapshotFields(m, ts))
    .filter((s) => s.marketId && s.probability != null);

  // If file already exists for this ts, merge + dedupe
  let existing = [];
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      existing = Array.isArray(parsed.snapshots) ? parsed.snapshots : [];
    } catch {
      existing = [];
    }
  }

  const key = (s) => `${s.marketId}|${s.ts}`;
  const map = new Map(existing.map((s) => [key(s), s]));
  for (const s of incoming) map.set(key(s), s);

  const snapshots = [...map.values()];

  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        ts,
        fetchedAt: new Date().toISOString(),
        count: snapshots.length,
        snapshots,
      },
      null,
      2
    )
  );

  console.log(`[snapshots] ts=${ts} wrote=${incoming.length} totalInFile=${snapshots.length}`);
  console.log(`[snapshots] Saved to ${filePath}`);

  return snapshots.length;
}

async function fetchMarkets() {
  let offset = 0;

  const allFlatMarkets = [];

  console.log("[fetchMarkets] fetching...")

  while (true) {
    const url = new URL(EVENTS_PATH, GAMMA_API_BASE);
    url.searchParams.set("closed", "false");
    url.searchParams.set("ascending", "false");
    url.searchParams.set("volume_min", String(VOLUME_MIN));
    url.searchParams.set("offset", String(offset))
    url.searchParams.set("limit", String(LIMIT));

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

    const events = await res.json();

    const flat = flattenEventsToMarkets(events);
    allFlatMarkets.push(...flat);

    if (events.length < LIMIT) break;
    offset += LIMIT;
  }

  const deduped = dedupeByMarketId(allFlatMarkets);
  saveSnapshots(deduped);
  const masterMarkets = upsertMasterMarkets(deduped);
  const savedCount = saveMasterMarkets(masterMarkets);

  console.log(`\nDONE: volumeMin=${VOLUME_MIN} -> count=${savedCount}`);
}

async function main() {
  try {
    await fetchMarkets();
  } catch (err) {
    console.error("[fetchMarkets] Error:", err.message);
    process.exit(1);
  }
}

main();