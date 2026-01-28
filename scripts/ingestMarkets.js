import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import process from "process";
import { Client } from "pg";
import "dotenv/config";


const PIPELINE_NAME = "polymarket_pipeline";
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function toRow(m) {
  const marketId = String(m.marketId ?? "");
  if (!marketId) return null;

  const question = m.question ?? null;
  const createdAt = m.createdAt ?? null; 
  const slug = m.slug ?? null;
  return [marketId, question, createdAt, slug];
}

function buildInsert(rows) {
  // rows: [market_id, question, created_at, slug]
  const colsPerRow = 4;

  const valuesSql = rows
    .map((_, i) => {
      const base = i * colsPerRow;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    })
    .join(",\n");

  const sql = `
    INSERT INTO markets (market_id, question, created_at, slug)
    VALUES
    ${valuesSql}
    ON CONFLICT (market_id) DO UPDATE SET
      question   = COALESCE(EXCLUDED.question, markets.question),
      created_at = COALESCE(EXCLUDED.created_at, markets.created_at),
      slug = COALESCE(EXCLUDED.slug, markets.slug)
  `;

  const params = rows.flat();
  return { sql, params };
}

async function main() {
  const masterPath = process.argv[2];
  if (!masterPath) {
    console.error("Usage: node ingestMarkets.js /path/to/master.json");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Missing DATABASE_URL in .env");
    process.exit(1);
  }

  const raw = fs.readFileSync(path.join(PROJECT_ROOT, masterPath), "utf8");
  const data = JSON.parse(raw);

  const markets = data.markets;
  if (!Array.isArray(markets)) {
    throw new Error("No markets array found in master JSON");
  }

  // Build rows, skip bad entries
  const rowsAll = [];
  let skipped = 0;

  for (const m of markets) {
    const row = toRow(m);
    if (!row) {
      skipped++;
      continue;
    }
    rowsAll.push(row);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Update status to 0 markets ingested
  // This metric is used to show markets ingested on *each* run
  await client.query(
    `update pipeline_status
    set updated_at = now(),
        markets_ingested = 0
    where pipeline_name = $1`,
    [PIPELINE_NAME]
  );

  // Master list sits around 4,000 right now, this can be increased later
  const chunkSize = 1000;
  let upserted = 0;

  await client.query("BEGIN");
  try {
    for (let i = 0; i < rowsAll.length; i += chunkSize) {
      const chunk = rowsAll.slice(i, i + chunkSize);
      const { sql, params } = buildInsert(chunk);
      await client.query(sql, params);

      upserted += chunk.length;
    }

    await client.query("COMMIT");
    await client.query(
      `update pipeline_status
      set updated_at = now(),
          markets_ingested = $2
      where pipeline_name = $1`,
      [PIPELINE_NAME, upserted]
    );
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    await client.end();
  }

  console.log(`Done. Upserted: ${upserted} rows, skipped: ${skipped} rows`);
}

main().catch((e) => {
  console.error("Ingestion failed:", e);
  process.exit(1);
});
