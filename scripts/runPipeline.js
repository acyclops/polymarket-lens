import "dotenv/config";
import { Client } from "pg";
import { spawn } from "node:child_process";

const LOCK_KEY = 696969;
const PIPELINE_NAME = "polymarket_pipeline";
// Update node path when uploading to VPS
const NODE = process.env.NODE_PATH ?? "/Users/alex/.nvm/versions/node/v22.20.0/bin/node";

const STEPS = [
  { name: "fetch", cmd: NODE, args: ["scripts/fetchMarkets.js"] },
  { name: "master_ingest", cmd: NODE, args: ["scripts/ingestMarkets.js", "data/markets_master.json"] },
  { name: "snapshot_ingest", cmd: NODE, args: ["scripts/ingestSnapshots.js"] },
  { name: "compress_snapshots", cmd: NODE, args: ["scripts/compressSnapshots.js"] },
];

function runStep(step) {
  return new Promise((resolve, reject) => {
    console.log(`\n[pipeline] running step: ${step.name}`);

    const child = spawn(step.cmd, step.args, {
      stdio: "inherit",
      shell: false,
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Step "${step.name}" failed with exit code ${code}`));
    });
  });
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  const start = Date.now();
  let lockAcquired = false;

  await client.connect();

  // Check that PIPELINE_NAME row exists
  await client.query(
    `insert into pipeline_status (pipeline_name)
    values ($1)
    on conflict (pipeline_name) do nothing`,
    [PIPELINE_NAME]
  );

  try {
    const lockRes = await client.query(
      "select pg_try_advisory_lock($1) as locked",
      [LOCK_KEY]
    );

    if (!lockRes.rows[0]?.locked) {
      console.log("[pipeline] Another pipeline run is already active. Exiting.");
      return;
    }

    lockAcquired = true;

    console.log("[pipeline] Advisory lock acquired.");

    await client.query(
      `update pipeline_status
       set updated_at = now(),
        last_run_started_at = now(),
        last_run_finished_at = null,
        last_processing_ms = null,
        last_run_ok = null,
        last_error = null, 
        files_ingested = 0, 
        markets_ingested = 0,
        ticks_upserted = 0
       where pipeline_name = $1`,
       [PIPELINE_NAME]
    );

    for (const step of STEPS) {
      await runStep(step);
    }

    const ms = Date.now() - start;

    console.log(`\n[pipeline] SUCCESS in ${ms} ms`);

    await client.query(
      `update pipeline_status
       set updated_at = now(),
        last_run_finished_at = now(),
        last_run_ok = true,
        last_processing_ms = $1
       where pipeline_name = $2`,
      [ms, PIPELINE_NAME]
    );

  } catch (e) {
    const ms = Date.now() - start;
    console.error("\n[pipeline] FAILED:", e?.message ?? e);

    try {
      await client.query(
        `update pipeline_status
         set updated_at = now(),
          last_run_finished_at = now(),
          last_run_ok = false,
          last_processing_ms = $1,
          last_error = $2
         where pipeline_name = $3`,
        [ms, String(e?.message ?? e), PIPELINE_NAME]
      );
    } catch {}

    process.exitCode = 1;
  } finally {
    // Release lock
    try {
      if (lockAcquired) {
        await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
        console.log("[pipeline] Advisory lock released.");
      }
    } catch {}
    try {
      await client.end();
    } catch {}
  }
}

main();
