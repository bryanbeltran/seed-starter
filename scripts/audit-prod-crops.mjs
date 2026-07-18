#!/usr/bin/env node
/**
 * Prod crop audit: health, junk names, SSR chips, schedule API per crop.
 *   SMOKE_URL=https://seed-starter.vercel.app node scripts/audit-prod-crops.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { findJunkCrops } from "./catalog/lib/cropResolve.mjs";

const base = (process.env.SMOKE_URL ?? "https://seed-starter.vercel.app").replace(/\/$/, "");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/crops.json"), "utf8"));
const delayMs = Number(process.env.AUDIT_DELAY_MS ?? 1200);
const zip = process.env.AUDIT_ZIP ?? "55423";
const JUNK_CHIP = /^(seed|seeds|organic|red|dry|de|my|y|a|eco|op|type|winter)$/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function schedule(cropId, varietyId, attempt = 0) {
  const body = {
    zip,
    seeds: [cropId],
    riskProfile: "balanced",
    ...(varietyId ? { cropSelections: [{ cropId, varietyId }] } : {}),
  };
  const res = await fetch(`${base}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429 && attempt < 5) {
    const wait = delayMs * (attempt + 2);
    console.log(`  rate limited on ${cropId}, retry in ${wait}ms`);
    await sleep(wait);
    return schedule(cropId, varietyId, attempt + 1);
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, json };
}

function extractSsrChips(html) {
  const chips = new Set();
  for (const m of html.matchAll(/role="checkbox"[^>]*aria-label="([^"]+)"/g)) chips.add(m[1]);
  for (const m of html.matchAll(/aria-label="([^"]+)"[^>]*role="checkbox"/g)) chips.add(m[1]);
  return [...chips];
}

const errors = [];
const warnings = [];

const health = await (await fetch(`${base}/api/health`)).json();
const localCrops = Object.keys(catalog.crops).length;
const localVarieties = Object.values(catalog.crops).reduce(
  (n, c) => n + Object.keys(c.varieties ?? {}).length,
  0,
);

console.log(`Prod ${base} commit=${health.commit}`);
console.log(`Health: ${health.crops} crops, ${health.varieties} varieties`);
console.log(`Local:  ${localCrops} crops, ${localVarieties} varieties`);

if (health.crops !== localCrops) warnings.push(`crop count mismatch: prod ${health.crops} vs local ${localCrops}`);
if (health.varieties !== localVarieties) {
  warnings.push(`variety count mismatch: prod ${health.varieties} vs local ${localVarieties}`);
}

for (const msg of findJunkCrops(catalog.crops)) errors.push(`catalog junk: ${msg}`);

const html = await (await fetch(base)).text();
const chips = extractSsrChips(html);
const junkChips = chips.filter((n) => JUNK_CHIP.test(n));
if (junkChips.length) errors.push(`junk SSR chips: ${junkChips.join(", ")}`);
console.log(`SSR popular chips (${chips.length}): ${chips.join(", ")}`);

console.log(`\nSchedule audit (${Object.keys(catalog.crops).length} crops, ${delayMs}ms delay)...`);
const scheduleFails = [];
const noHarvest = [];
for (const [id, crop] of Object.entries(catalog.crops)) {
  await sleep(delayMs);
  const r = await schedule(id);
  if (!r.ok) {
    scheduleFails.push({ id, name: crop.name, status: r.status, error: r.json.error ?? r.json });
    continue;
  }
  if (!r.json.tasks?.some((t) => t.type === "harvest")) noHarvest.push(id);
  process.stdout.write(r.ok ? "." : "x");
}
console.log("");

if (scheduleFails.length) {
  for (const f of scheduleFails) {
    errors.push(`schedule ${f.id} (${f.name}): ${f.status} ${JSON.stringify(f.error)}`);
  }
}
if (noHarvest.length) errors.push(`missing harvest task: ${noHarvest.join(", ")}`);

const varietyFails = [];
for (const [cropId, crop] of Object.entries(catalog.crops)) {
  const varietyId = Object.keys(crop.varieties ?? {})[0];
  if (!varietyId) continue;
  await sleep(delayMs);
  const r = await schedule(cropId, varietyId);
  if (!r.ok) varietyFails.push({ cropId, varietyId, status: r.status, error: r.json.error });
}
if (varietyFails.length) {
  for (const f of varietyFails.slice(0, 10)) {
    errors.push(`variety ${f.cropId}/${f.varietyId}: ${f.status} ${f.error}`);
  }
  if (varietyFails.length > 10) errors.push(`...and ${varietyFails.length - 10} more variety failures`);
}

console.log(`Variety sample: ${Object.keys(catalog.crops).length} crops, ${varietyFails.length} fails`);

// Playwright browse scrape (optional)
if (process.env.AUDIT_UI !== "0") {
  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "All", exact: true }).click();
    const uiCrops = new Set();
    for (let i = 0; i < 8; i++) {
      for (const el of await page.locator('[aria-label="Available crops"] [role="checkbox"]').all()) {
        uiCrops.add((await el.getAttribute("aria-label")) ?? "");
      }
      const more = page.getByRole("button", { name: /Show more/i });
      if (!(await more.isVisible())) break;
      await more.click();
      await page.waitForTimeout(300);
    }
    await browser.close();
    const junkUi = [...uiCrops].filter((n) => JUNK_CHIP.test(n) || n.length <= 2);
    console.log(`Browse UI crops (${uiCrops.size}): ${[...uiCrops].sort().join(", ")}`);
    if (junkUi.length) errors.push(`junk browse chips: ${junkUi.join(", ")}`);
  } catch (err) {
    warnings.push(`UI scrape skipped: ${err.message}`);
  }
}

if (warnings.length) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

if (errors.length) {
  console.log("\nErrors:");
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}

console.log("\nProd crop audit OK");
