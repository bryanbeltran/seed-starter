#!/usr/bin/env node
/** Exact-id golden check for ZIP → EPA L3 ecoregion. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mapPath = path.join(root, "data/natives/zip-ecoregion.json");
const goldenPath = path.join(root, "data/natives/golden-zips.json");

if (!fs.existsSync(mapPath)) {
  console.error("Missing data/natives/zip-ecoregion.json — run pnpm run etl:natives-ecoregion -- --write");
  process.exit(1);
}

const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
const minRate = golden.minMatchRate ?? 0.9;

let ok = 0;
const failures = [];
for (const row of golden.zips) {
  const got = map.zips?.[row.zip];
  const gotId = typeof got === "string" ? got : got?.id;
  if (gotId === row.ecoregionId) {
    ok++;
  } else {
    failures.push(`${row.zip}: expected ${row.ecoregionId}, got ${gotId ?? "missing"}`);
  }
}

const rate = ok / golden.zips.length;
console.log(`Native ecoregion golden: ${ok}/${golden.zips.length} (${(rate * 100).toFixed(1)}%)`);
for (const f of failures) console.log(`  ✗ ${f}`);
if (rate < minRate) {
  console.error(`Below minMatchRate ${minRate}`);
  process.exit(1);
}
