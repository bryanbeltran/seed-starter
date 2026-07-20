#!/usr/bin/env node
/** Exact-id golden check for ZIP → EPA L3 ecoregion (+ county overlay + catalog depth). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mapPath = path.join(root, "data/natives/zip-ecoregion.json");
const countyPath = path.join(root, "data/natives/zip-county.json");
const plantsPath = path.join(root, "data/natives/plants.json");
const ecoPath = path.join(root, "data/natives/ecoregion-plants.json");
const goldenPath = path.join(root, "data/natives/golden-zips.json");

for (const p of [mapPath, countyPath, plantsPath, ecoPath, goldenPath]) {
  if (!fs.existsSync(p)) {
    console.error(`Missing ${path.relative(root, p)}`);
    process.exit(1);
  }
}

const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const county = JSON.parse(fs.readFileSync(countyPath, "utf8"));
const plants = JSON.parse(fs.readFileSync(plantsPath, "utf8"));
const eco = JSON.parse(fs.readFileSync(ecoPath, "utf8"));
const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
const minRate = golden.minMatchRate ?? 0.9;
const minPlants = 15;

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
  if (!county.zips?.[row.zip]) {
    failures.push(`${row.zip}: missing county overlay`);
  }
}

const plantIds = new Set(Object.keys(plants.plants ?? {}));
for (const [eid, listing] of Object.entries(eco.ecoregions ?? {})) {
  const ids = listing.plantIds ?? [];
  if (ids.length < minPlants) {
    failures.push(`L3 ${eid}: ${ids.length} plants < ${minPlants}`);
  }
  for (const id of ids) {
    if (!plantIds.has(id)) failures.push(`L3 ${eid}: missing plant ${id}`);
  }
}

const rate = ok / golden.zips.length;
console.log(`Native ecoregion golden: ${ok}/${golden.zips.length} (${(rate * 100).toFixed(1)}%)`);
console.log(`Curated L3 catalogs: ${Object.keys(eco.ecoregions).join(", ")}`);
for (const f of failures) console.log(`  ✗ ${f}`);
if (rate < minRate || failures.length) {
  console.error("Native ecoregion check failed");
  process.exit(1);
}
