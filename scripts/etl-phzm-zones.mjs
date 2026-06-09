#!/usr/bin/env node
/**
 * ETL: PRISM 2023 USDA PHZM ZIP → zone lookup table
 *
 *   pnpm run etl:phzm
 *   pnpm run etl:phzm -- --write
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchPhzmZipZones } from "./lib/ghcn-zip-climate.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");

async function main() {
  console.log("Fetching PRISM 2023 PHZM ZIP CSV…");
  const zones = await fetchPhzmZipZones();
  console.log(`Parsed ${Object.keys(zones).length} ZIP → zone rows`);

  if (write) {
    const outPath = path.join(root, "data/zipZones-phzm.json");
    fs.writeFileSync(outPath, JSON.stringify(zones) + "\n");
    const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
    console.log(`Wrote ${outPath} (${mb} MB)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
