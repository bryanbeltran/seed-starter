#!/usr/bin/env node
/** Snapshot fallP50 from zipClimate into golden-zips.json (run after fall regen). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const goldenPath = path.join(root, "data/golden-zips.json");
const climate = JSON.parse(fs.readFileSync(path.join(root, "data/zipClimate.json"), "utf8"));
const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));

let updated = 0;
let missing = 0;
for (const entry of golden.zips) {
  const fall = climate[entry.zip]?.firstFallFrostP50;
  if (!fall) {
    missing++;
    continue;
  }
  if (entry.fallP50 !== fall) {
    entry.fallP50 = fall;
    updated++;
  }
}

golden.description =
  "Golden ZIP frost eval — expected lastFrostP50 + optional firstFallFrostP50 bands";
fs.writeFileSync(goldenPath, JSON.stringify(golden, null, 2) + "\n");
console.log(`Updated ${updated} fallP50 values; ${missing} missing fall climate`);
