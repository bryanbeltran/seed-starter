#!/usr/bin/env node
/**
 * Merge seasons.summer into data/catalog/crops.json for crops with SUMMER_DEFAULTS.
 *   node scripts/catalog/patch-summer-seasons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SUMMER_DEFAULTS, summerSeason } from "./lib/cropDefaults.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const catalogPath = path.join(root, "data/catalog/crops.json");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
let patched = 0;
let missing = 0;

for (const [cropId, block] of Object.entries(SUMMER_DEFAULTS)) {
  const crop = catalog.crops[cropId];
  if (!crop) {
    missing++;
    continue;
  }
  crop.seasons = { ...(crop.seasons ?? {}), summer: summerSeason(block) };
  patched++;
}

catalog.generatedAt = new Date().toISOString();
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Patched summer seasons for ${patched} crops; ${missing} missing from catalog`);
