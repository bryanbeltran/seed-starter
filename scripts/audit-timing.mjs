#!/usr/bin/env node
/**
 * Audit crop spring timing for horticultural plausibility.
 *   node scripts/audit-timing.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cropDefaults, cropFallDefaults } from "./catalog/lib/cropDefaults.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { crops } = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/crops.json"), "utf8"));

const errors = [];
const warnings = [];

const WARM_TRANSPLANT = new Set([
  "tomato", "pepper", "eggplant", "tomatillo", "ground-cherry", "cucumber",
  "melon", "watermelon", "cantaloupe", "honeydew", "okra", "basil", "sweet-potato",
]);

const WARM_DIRECT = new Set([
  "beans", "corn", "squash-summer", "squash-winter", "pumpkin", "gourd", "luffa",
  "soybean", "edamame", "amaranth", "buckwheat", "quinoa", "flax", "sunflower",
]);

const COOL_BEFORE = new Set([
  "broccoli", "kale", "cabbage", "cauliflower", "brussels-sprouts", "collards",
  "lettuce", "onion", "leek", "shallot", "pea", "spinach", "carrot", "beet",
  "radish", "parsnip", "kohlrabi", "celery", "artichoke",
]);

const PERENNIAL = new Set(["asparagus", "rhubarb", "grape", "blueberry", "horseradish"]);

function fmtDirect(days) {
  if (days > 0) return `${days}d before frost`;
  if (days < 0) return `${-days}d after frost`;
  return "at frost";
}

function auditCrop(id, crop) {
  const d = cropDefaults(id);
  const s = crop.seasons?.spring;
  if (!s) errors.push(`${id}: missing seasons.spring`);
  if (s?.anchor !== "lastSpringFrost") warnings.push(`${id}: unexpected anchor ${s?.anchor}`);

  if (s && s.method !== d.method) {
    errors.push(`${id}: catalog method ${s.method} != default ${d.method}`);
  }

  if (d.method === "transplant") {
    const tx = s?.transplantDaysAfterAnchor ?? d.transplantDaysAfterFrost ?? 0;
    const indoor = s?.indoorSowOffsetDays ?? d.indoorSowOffsetDays;
    if (indoor == null || indoor < 14) warnings.push(`${id}: indoor sow ${indoor}d seems short`);
    if (WARM_TRANSPLANT.has(id) && tx < 0) {
      errors.push(`${id}: warm crop transplants before frost (${tx}d)`);
    }
    if (COOL_BEFORE.has(id) && tx > 0) {
      warnings.push(`${id}: cool crop transplants after frost (${tx}d)`);
    }
  } else {
    const sow = s?.directSowDaysBeforeAnchor ?? d.directSowDaysBeforeFrost ?? 0;
    if (COOL_BEFORE.has(id) && sow <= 0) {
      warnings.push(`${id}: cool crop sows ${fmtDirect(sow)}`);
    }
    if (WARM_DIRECT.has(id) && sow > 0) {
      errors.push(`${id}: warm crop sows ${fmtDirect(sow)} — want at/after frost`);
    }
  }

  if (crop.daysToHarvest < 14) errors.push(`${id}: daysToHarvest ${crop.daysToHarvest} too low`);
  if (crop.daysToHarvest > 400) errors.push(`${id}: daysToHarvest ${crop.daysToHarvest} > 400`);

  if (id === "garlic" && (s?.directSowDaysBeforeAnchor ?? 0) < 90) {
    warnings.push(`${id}: fall-planted; needs large pre-frost offset (got ${s?.directSowDaysBeforeAnchor})`);
  }
  if (PERENNIAL.has(id)) warnings.push(`${id}: perennial — harvest date is establishment proxy`);
  if (id === "microgreens") warnings.push(`${id}: frost model N/A`);

  auditFall(id, crop);
}

function auditFall(id, crop) {
  const f = crop.seasons?.fall;
  const d = cropFallDefaults(id);
  if (!f && !d) return;
  if (!f && d) {
    warnings.push(`${id}: FALL_DEFAULTS exist but catalog has no seasons.fall`);
    return;
  }
  if (f.anchor !== "firstFallFrost") errors.push(`${id}: fall anchor ${f.anchor} != firstFallFrost`);
  if (f.method === "transplant") {
    const tx = f.transplantDaysAfterAnchor ?? 0;
    const indoor = f.indoorSowOffsetDays;
    if (indoor == null || indoor < 14) warnings.push(`${id}: fall indoor sow ${indoor}d seems short`);
    if (tx > 0) warnings.push(`${id}: fall transplant ${tx}d after frost — usually before`);
    if (tx < -150) warnings.push(`${id}: fall transplant ${tx}d before frost — very early`);
  } else {
    const sow = f.directSowDaysBeforeAnchor ?? 0;
    if (sow < 0 && id !== "garlic") {
      warnings.push(`${id}: fall direct sow ${fmtDirect(sow)} — unusual for fall`);
    }
    if (sow > 200) warnings.push(`${id}: fall direct sow ${sow}d before frost — very early`);
  }
}

const DTM_WARN = 60;
const DTM_FAIL = 250;

function auditVarietyDtm(id, crop) {
  for (const v of Object.values(crop.varieties ?? {})) {
    if (v.daysToHarvest == null) continue;
    const delta = Math.abs(v.daysToHarvest - crop.daysToHarvest);
    const msg = `${id}/${v.id}: |ΔDTH|=${delta} (crop ${crop.daysToHarvest} vs variety ${v.daysToHarvest})`;
    if (delta >= DTM_FAIL) errors.push(msg);
    else if (delta >= DTM_WARN) warnings.push(msg);
  }
}

for (const [id, crop] of Object.entries(crops).sort((a, b) => a[0].localeCompare(b[0]))) {
  auditCrop(id, crop);
  auditVarietyDtm(id, crop);
}

const profiles = new Map();
for (const [id, crop] of Object.entries(crops)) {
  const key = JSON.stringify(crop.seasons.spring);
  if (!profiles.has(key)) profiles.set(key, []);
  profiles.get(key).push(id);
}

console.log(`Audited ${Object.keys(crops).length} crops\n`);

if (errors.length) {
  console.log(`Errors (${errors.length}):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
}

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

if (!errors.length && !warnings.length) console.log("No issues found.");

console.log("\nTop profiles:");
for (const [key, ids] of [...profiles.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10)) {
  const s = JSON.parse(key);
  const label =
    s.method === "transplant"
      ? `tx ${s.transplantDaysAfterAnchor >= 0 ? "+" : ""}${s.transplantDaysAfterAnchor}d`
      : fmtDirect(s.directSowDaysBeforeAnchor);
  console.log(`  ${ids.length}x ${label}: ${ids.slice(0, 6).join(", ")}${ids.length > 6 ? "…" : ""}`);
}

process.exit(errors.length ? 1 : 0);
