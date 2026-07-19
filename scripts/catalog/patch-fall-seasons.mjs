#!/usr/bin/env node
/**
 * Merge seasons.fall into data/catalog/crops.json for crops with FALL_DEFAULTS.
 * Idempotent: preserves existing spring; overwrites existing fall from defaults.
 *   node scripts/catalog/patch-fall-seasons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FALL_DEFAULTS, fallSeason } from "./lib/cropDefaults.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const catalogPath = path.join(root, "data/catalog/crops.json");

if (!fs.existsSync(catalogPath)) {
  console.error("Missing data/catalog/crops.json");
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
let patched = 0;
let missing = 0;

for (const [cropId, block] of Object.entries(FALL_DEFAULTS)) {
  const crop = catalog.crops[cropId];
  if (!crop) {
    missing++;
    continue;
  }
  crop.seasons = { ...(crop.seasons ?? {}), fall: fallSeason(block) };
  patched++;
}

catalog.generatedAt = new Date().toISOString();
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Patched fall seasons for ${patched} crops; ${missing} FALL_DEFAULTS missing from catalog`);
