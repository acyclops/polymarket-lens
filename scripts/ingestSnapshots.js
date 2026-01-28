import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import process from "process";
import { Client } from "pg";

const PIPELINE_NAME = "polymarket_pipeline";
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotsDir = path.join(PROJECT_ROOT, "data/snapshots");

// Handles batching so we don't do a million individual inserts
function buildInsertQuery(rows) {
  // rows: [market_id, ts, fetched_at, probability, volume24hr, liquidity]

  const colsPerRow = 6;
  const valuesSql = rows
    .map((_, i) => {
      const base = i * colsPerRow;
      const ph = Array.from({ length: colsPerRow }, (_, j) => `$${base + j + 1}`);
      return `(${ph.join(",")})`;
    })
    .join(",\n");

  const sql = `
    INSERT INTO market_ticks (market_id, ts, fetched_at, probability, volume24hr, liquidity)
    VALUES
    ${valuesSql}
    ON CONFLICT (market_id, ts) DO UPDATE SET
      fetched_at  = EXCLUDED.fetched_at,
      probability = EXCLUDED.probability,
      volume24hr  = EXCLUDED.volume24hr,
      liquidity   = EXCLUDED.liquidity
  `;

  return { sql, params: rows.flat() };
}

async function batchIngestFiles(client, filePath, chunkSize = 1000) {
  const raw = fs.readFileSync(filePath, "utf8");
  const snap = JSON.parse(raw);

  const ts = snap.ts;
  const fetchedAt = snap.fetchedAt;
  const items = snap.snapshots ?? [];

  if (!ts || !fetchedAt || !Array.isArray(items)) {
    throw new Error(`Bad snapshot in ${filePath}`);
  }

  let inserted = 0;
  let skipped = 0;

  // Batches rows into large queries using `buildInsertQuery`
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    const rows = [];
    for (const m of chunk) {
      const marketId = String(m.marketId ?? "");
      if (!marketId) { skipped++; continue; }

      rows.push([
        marketId,
        ts,
        fetchedAt,
        m.probability ?? null,
        m.volume24hr ?? null,
        m.liquidity ?? null,
      ]);
    }

    if (rows.length === 0) continue;

    const { sql, params } = buildInsertQuery(rows);
    await client.query(sql, params);
    inserted += rows.length;
  }

  return { file: path.basename(filePath), inserted, skipped, ts, fetchedAt };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  if (!fs.existsSync(snapshotsDir)) {
    console.error(`Missing folder: ${snapshotsDir}`);
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  // Grab cached last ingested file
  const statusRes = await client.query(
    `select last_ingested_snapshot_file
    from pipeline_status
    where pipeline_name = $1`,
    [PIPELINE_NAME]
  );

  const lastFile = statusRes.rows[0]?.last_ingested_snapshot_file ?? null;

  let files = fs
    .readdirSync(snapshotsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  // Only ingest files created after `lastFile`
  // Assumes filenames contain timestamp and are sorted by time when sorted alphabetically
  if (lastFile) {
    files = files.filter((f) => f > lastFile);
  }

  files = files.map((f) => path.join(snapshotsDir, f));

  if (files.length === 0) {
    console.log("No new snapshot files to ingest.");
    await client.end();
    return;
  }

  let totalInserted = 0;
  let totalSkipped = 0;

  try {
    for (const filePath of files) {
      try {
        await client.query("BEGIN");
        const res = await batchIngestFiles(client, filePath, 1000);
        await client.query("COMMIT");

        // Cache last ingested file
        // Doing this after ingestion means a failed ingestion
        //  could result in re-ingesting already ingested files
        //  this is okay since we upsert rows, data will not be duplicated
        await client.query(
          `
          update pipeline_status
          set
            updated_at = now(),
            last_ingested_snapshot_file = $2,
            last_ingested_snapshot_ts = $3::timestamptz,
            ticks_upserted = coalesce(ticks_upserted, 0) + $4,
            files_ingested = coalesce(files_ingested, 0) + 1
          where pipeline_name = $1
          `,
          [PIPELINE_NAME, res.file, res.ts, res.inserted]
        );

        totalInserted += res.inserted;
        totalSkipped += res.skipped;

        console.log(`OK ${res.file}: upserted=${res.inserted} skipped=${res.skipped} ts=${res.ts}`);
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        
        console.error(`FAIL ${path.basename(filePath)}:`, e?.message ?? e);
        // keep going after logging failed ingestion
      }
    }

    console.log(`DONE inserted=${totalInserted} skipped=${totalSkipped} files=${files.length}`);
  } finally {
    await client.end();
  }
}

main();
