// node scripts/printSnapshotGz.js data/snapshots/{snapshot_file}

import fs from "node:fs";
import zlib from "node:zlib";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node printSnapshotGz.js <path-to-.json.gz>");
  process.exit(1);
}

fs.createReadStream(file)
  .pipe(zlib.createGunzip())
  .pipe(process.stdout)
  .on("error", (err) => {
    console.error("Error:", err);
    process.exit(1);
  });