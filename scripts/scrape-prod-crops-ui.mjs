#!/usr/bin/env node
/**
 * Scrape prod crop picker UI for junk/broken chips.
 *   node scripts/scrape-prod-crops-ui.mjs
 *   SMOKE_URL=https://seed-starter.vercel.app node scripts/scrape-prod-crops-ui.mjs
 */
import { chromium } from "@playwright/test";

const base = (process.env.SMOKE_URL ?? "https://seed-starter.vercel.app").replace(/\/$/, "");

const JUNK = new Set([
  "seed", "seeds", "organic", "red", "dry", "de", "my", "y", "a", "eco", "op",
  "type", "winter", "class", "gmo", "non", "the", "and", "for",
]);

const TABS = ["Popular", "All", "Vegetables", "Herbs", "Fruits"];

function flag(name) {
  const issues = [];
  const id = name.trim().toLowerCase();
  if (JUNK.has(id)) issues.push("junk-token");
  if (name.length <= 2) issues.push("too-short");
  if (/^(type|seed|organic)\b/i.test(name)) issues.push("junk-prefix");
  if (/^\d+$/.test(name)) issues.push("numeric");
  if (/[<>{}]/.test(name)) issues.push("html-ish");
  return issues;
}

async function scrapeChips(page) {
  const loc = page.locator('[aria-label="Available crops"] [role="checkbox"]');
  const names = [];
  for (const el of await loc.all()) {
    const label = await el.getAttribute("aria-label");
    if (label) names.push(label);
  }
  return names;
}

async function loadAll(page) {
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    for (const n of await scrapeChips(page)) seen.add(n);
    const more = page.getByRole("button", { name: /Show more/i });
    if (!(await more.isVisible().catch(() => false))) break;
    await more.click();
    await page.waitForTimeout(400);
  }
  return [...seen];
}

async function scrapeTab(page, tab) {
  await page.getByRole("button", { name: tab, exact: true }).click();
  await page.waitForTimeout(300);
  const chips = await loadAll(page);
  const countText = await page.locator('[aria-live="polite"]').first().textContent();
  return { tab, chips, countText: countText?.trim() ?? "" };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(base, { waitUntil: "networkidle" });

const errors = [];
const report = {};

for (const tab of TABS) {
  const { chips, countText } = await scrapeTab(page, tab);
  const flagged = chips.flatMap((name) => {
    const issues = flag(name);
    return issues.length ? [{ name, issues }] : [];
  });
  report[tab] = { count: chips.length, countText, chips: chips.sort(), flagged };
  if (flagged.length) {
    for (const f of flagged) errors.push(`${tab}: "${f.name}" → ${f.issues.join(", ")}`);
  }
}

// Search smoke: junk tokens should not surface as exact crop names
for (const q of ["seed", "organic", "type", "de"]) {
  await page.getByLabel("Search crops").fill(q);
  await page.waitForTimeout(400);
  const hits = await scrapeChips(page);
  const exactJunk = hits.filter((n) => n.toLowerCase() === q);
  report[`search:${q}`] = hits;
  if (exactJunk.length) errors.push(`search "${q}" exact junk hit: ${exactJunk.join(", ")}`);
  await page.getByLabel("Search crops").fill("");
  await page.waitForTimeout(200);
}

await browser.close();

console.log(`UI scrape: ${base}\n`);
for (const tab of TABS) {
  const r = report[tab];
  console.log(`[${tab}] ${r.countText}`);
  console.log(`  ${r.chips.join(", ")}`);
  if (r.flagged.length) {
    for (const f of r.flagged) console.log(`  ✗ ${f.name} (${f.issues.join(", ")})`);
  }
  console.log("");
}

if (errors.length) {
  console.log("Errors:");
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}

console.log("UI scrape OK — no crop errors");
