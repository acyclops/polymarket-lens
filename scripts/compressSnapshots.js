import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SNAPSHOT_DIR = path.resolve(__dirname, "..", "data", "snapshots");

async function compressFile(jsonPath) {
  const gzPath = `${jsonPath}.gz`;

  // Skip if already compressed
  if (fs.existsSync(gzPath)) {
    console.log(`[compress] skip: ${path.basename(jsonPath)}`);
    return;
  }

  await pipeline(
    fs.createReadStream(jsonPath),
    zlib.createGzip({ level: 9 }),
    fs.createWriteStream(gzPath)
  );

  // Sanity check
  const { size } = await fs.promises.stat(gzPath);
  if (size === 0) {
    throw new Error(`Compressed file is empty: ${gzPath}`);
  }

  await fs.promises.unlink(jsonPath);
  console.log(`[compress] ok: ${path.basename(jsonPath)} → ${path.basename(gzPath)}`);
}

async function main() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    throw new Error(`Snapshot dir not found: ${SNAPSHOT_DIR}`);
  }

  const files = await fs.promises.readdir(SNAPSHOT_DIR);

  const jsonFiles = files.filter(
    (f) => f.endsWith(".json") && !f.endsWith(".json.gz")
  );

  if (jsonFiles.length === 0) {
    console.log("[compress] nothing to compress");
    return;
  }

  for (const file of jsonFiles) {
    await compressFile(path.join(SNAPSHOT_DIR, file));
  }

  console.log(`[compress] done (${jsonFiles.length} files)`);
}

main().catch((err) => {
  console.error("[compress] FAILED:", err);
  process.exit(1);
});
