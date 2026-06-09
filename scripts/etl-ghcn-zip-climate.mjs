#!/usr/bin/env node
/**
 * ETL: ZIP centroids → nearest GHCN station → last-frost percentiles → zipClimate.json
 *
 *   node scripts/etl-ghcn-zip-climate.mjs
 *   node scripts/etl-ghcn-zip-climate.mjs --write
 *   node scripts/etl-ghcn-zip-climate.mjs --fetch-stations --write
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildZipClimate,
  fetchGhcndStations,
  loadJson,
} from "./lib/ghcn-zip-climate.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
const fetchStations = process.argv.includes("--fetch-stations");

async function main() {
  let stationsOverride = null;

  if (fetchStations) {
    console.log("Fetching NOAA ghcnd-stations.txt…");
    const fetched = await fetchGhcndStations();
    const bundled = loadJson(root, "data/ghcn/stations.json");
    const byId = new Map(bundled.map((s) => [s.id, s]));
    for (const s of fetched) {
      if (!byId.has(s.id)) byId.set(s.id, s);
    }
    stationsOverride = [...byId.values()];
    console.log(`Station pool: ${stationsOverride.length} (bundled + NOAA US)`);
  }

  const { output, skipped, stationCount } = buildZipClimate(root, {
    stationsOverride,
    dataVersion: `ghcn-${new Date().toISOString().slice(0, 10)}`,
  });

  const rows = Object.values(output);
  console.log(`Built ${rows.length} ZIP records from ${stationCount} stations`);
  if (skipped.length) {
    console.warn(`Skipped ZIPs (missing centroid or TMIN): ${skipped.join(", ")}`);
  }

  console.table(
    rows.map((r) => ({
      zip: r.zip,
      zone: r.zone,
      station: r.stationId,
      km: r.distanceKm,
      p50: r.lastFrostP50,
      p90: r.lastFrostP90,
    })),
  );

  if (write) {
    const outPath = path.join(root, "data/zipClimate.json");
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
    console.log(`\nWrote ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
