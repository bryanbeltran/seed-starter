#!/usr/bin/env node
/**
 * ETL: gather seed catalog from top 5 US seed sources.
 *
 *   pnpm run etl:catalog
 *   pnpm run etl:catalog -- --write
 *   pnpm run etl:catalog -- --source=johnnys --limit=50
 *   pnpm run etl:catalog -- --target=2000 --write
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mergeRecords } from "./lib/merge.mjs";
import { validateCatalog } from "./lib/validate.mjs";
import * as johnnys from "./sources/johnnys.mjs";
import * as highmowing from "./sources/highmowing.mjs";
import * as territorial from "./sources/territorial.mjs";
import * as fedco from "./sources/fedco.mjs";
import * as bakercreek from "./sources/bakercreek.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCES = [johnnys, highmowing, territorial, fedco, bakercreek];

const write = process.argv.includes("--write");
const refresh = process.argv.includes("--refresh");
const sourceArg = process.argv.find((a) => a.startsWith("--source="));
const sourceFilter = sourceArg?.split("=")[1];
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const targetArg = process.argv.find((a) => a.startsWith("--target="));
const target = targetArg ? Number(targetArg.split("=")[1]) : 2000;

async function runSource(mod, perSourceLimit) {
  console.log(`\n[${mod.meta.id}] ${mod.meta.name}`);
  const t0 = Date.now();
  const records = await mod.collect(root, { limit: perSourceLimit, refresh });
  console.log(`  → ${records.length} records (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return records;
}

async function main() {
  const active = sourceFilter
    ? SOURCES.filter((s) => s.meta.id === sourceFilter)
    : SOURCES;

  if (!active.length) {
    console.error(`Unknown source: ${sourceFilter}`);
    process.exit(1);
  }

  const limits = { johnnys: 1500, highmowing: 1500, territorial: 1500, fedco: 1500, bakercreek: 500 };
  const all = [];
  for (const mod of active) {
    const perSource = Number.isFinite(limit) ? limit : limits[mod.meta.id] ?? 1000;
    const records = await runSource(mod, perSource);
    all.push(...records);
  }

  console.log(`\nMerging ${all.length} raw records (target ${target})…`);
  const { crops, varietyCount, cropCount } = mergeRecords(all, { target });
  const catalog = { version: 1, generatedAt: new Date().toISOString(), crops };

  const errors = validateCatalog(catalog);
  if (errors.length) {
    console.warn("Validation warnings:");
    for (const e of errors) console.warn(`  - ${e}`);
  }

  console.log(`Catalog: ${cropCount} crops, ${varietyCount} varieties`);

  const sourcesMeta = Object.fromEntries(
    SOURCES.map((s) => [
      s.meta.id,
      { ...s.meta, fetchedAt: new Date().toISOString() },
    ]),
  );

  if (write) {
    const dir = path.join(root, "data/catalog");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "sources.json"), JSON.stringify(sourcesMeta, null, 2) + "\n");
    fs.writeFileSync(path.join(dir, "crops.json"), JSON.stringify(catalog, null, 2) + "\n");
    console.log(`Wrote data/catalog/crops.json`);
  } else {
    console.log("Dry run — pass --write to save.");
  }

  if (varietyCount < target && !sourceFilter) {
    console.warn(`Below target (${varietyCount}/${target}). Sources may be exhausted or rate-limited.`);
    process.exit(varietyCount < 1000 ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
