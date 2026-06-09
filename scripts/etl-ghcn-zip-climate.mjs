#!/usr/bin/env node
/**
 * ETL: ZCTA centroids → nearest GHCN station → last-frost percentiles → zipClimate.json
 *
 *   pnpm run etl:climate
 *   pnpm run etl:climate -- --write
 *   pnpm run etl:climate -- --fetch-centroids --fetch-daily --full --write
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildZipClimate,
  fetchBundledStationTmin,
  fetchGhcndStations,
  fetchZctaCentroids,
  loadJson,
} from "./lib/ghcn-zip-climate.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
const fetchStations = process.argv.includes("--fetch-stations");
const fetchCentroids = process.argv.includes("--fetch-centroids");
const fetchDaily = process.argv.includes("--fetch-daily");
const full = process.argv.includes("--full");

async function main() {
  let stationsOverride = null;
  let centroidsOverride = null;
  let tminOverride = null;

  if (fetchStations) {
    console.log("Fetching NOAA ghcnd-stations.txt…");
    const fetched = await fetchGhcndStations();
    const bundled = loadJson(root, "data/ghcn/stations.json");
    const byId = new Map(bundled.map((s) => [s.id, s]));
    for (const s of fetched) {
      if (!byId.has(s.id)) byId.set(s.id, s);
    }
    stationsOverride = [...byId.values()];
    console.log(`Station pool: ${stationsOverride.length}`);
  }

  const centroidsPath = path.join(root, "data/zctaCentroids.json");
  if (fetchCentroids || (full && fs.existsSync(centroidsPath))) {
    if (fetchCentroids) {
      console.log("Fetching Census ZCTA gazetteer…");
      centroidsOverride = await fetchZctaCentroids(path.join(root, "data/.cache"));
      if (write) {
        fs.writeFileSync(centroidsPath, JSON.stringify(centroidsOverride) + "\n");
        console.log(`Wrote ${centroidsPath} (${Object.keys(centroidsOverride).length} ZIPs)`);
      }
    } else {
      centroidsOverride = loadJson(root, "data/zctaCentroids.json");
      console.log(`Loaded ${Object.keys(centroidsOverride).length} cached centroids`);
    }
  }

  const bundledStations = loadJson(root, "data/ghcn/stations.json");
  if (fetchDaily) {
    console.log("Fetching GHCN-Daily TMIN for bundled stations…");
    tminOverride = await fetchBundledStationTmin(
      bundledStations.map((s) => s.id),
    );
    const tminPath = path.join(root, "data/ghcn/tmin-parsed.json");
    if (write) {
      fs.writeFileSync(tminPath, JSON.stringify(tminOverride, null, 2) + "\n");
      console.log(`Wrote ${tminPath}`);
    }
  } else if (fs.existsSync(path.join(root, "data/ghcn/tmin-parsed.json"))) {
    tminOverride = loadJson(root, "data/ghcn/tmin-parsed.json");
  }

  const dataVersion = `ghcn-${new Date().toISOString().slice(0, 10)}`;
  const { output, skipped, stationCount, zipCount } = buildZipClimate(root, {
    stationsOverride,
    centroidsOverride,
    tminOverride,
    full,
    dataVersion,
    provenance: fetchDaily
      ? "NOAA GHCN-Daily parsed TMIN"
      : "NOAA GHCN-Daily nearest-station median",
  });

  const rows = Object.values(output);
  console.log(`Built ${zipCount} ZIP records from ${stationCount} stations`);
  if (skipped.length && skipped.length <= 20) {
    console.warn(`Skipped: ${skipped.join(", ")}`);
  } else if (skipped.length) {
    console.warn(`Skipped ${skipped.length} ZIPs (missing centroid or TMIN)`);
  }

  console.table(rows.slice(0, 10).map((r) => ({
    zip: r.zip,
    zone: r.zone ?? "—",
    station: r.stationId,
    km: r.distanceKm,
    p50: r.lastFrostP50,
  })));

  if (write) {
    const outPath = path.join(root, "data/zipClimate.json");
    fs.writeFileSync(outPath, JSON.stringify(output) + "\n");
    const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
    console.log(`\nWrote ${outPath} (${mb} MB, ${zipCount} ZIPs)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
