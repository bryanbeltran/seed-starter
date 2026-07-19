#!/usr/bin/env node
/**
 * ETL: ZCTA centroids → nearest GHCN station → last-frost percentiles → zipClimate.json
 *
 *   pnpm run etl:climate
 *   pnpm run etl:climate -- --write
 *   pnpm run etl:climate -- --fetch-stations --fetch-daily-needed --full --write
 *   pnpm run etl:climate -- --refetch-missing-fall --full --write
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildUsTminStationPool,
  buildZipClimate,
  computeNeededStationIds,
  fetchBundledStationTmin,
  fetchZctaCentroids,
  loadJson,
  mergeTminCaches,
  normalizeTminCache,
  selectRepresentativeStations,
  stationHasFallFrostTmin,
  tryLoadJson,
} from "./lib/ghcn-zip-climate.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
const fetchStations = process.argv.includes("--fetch-stations");
const fetchCentroids = process.argv.includes("--fetch-centroids");
const fetchDaily = process.argv.includes("--fetch-daily");
const fetchDailyNeeded = process.argv.includes("--fetch-daily-needed");
const fetchDailyRepresentative = process.argv.includes("--fetch-daily-representative");
const refetchMissingFall = process.argv.includes("--refetch-missing-fall");
const full = process.argv.includes("--full");

const cellDegArg = process.argv.find((a) => a.startsWith("--cell-deg="));
const cellDeg = cellDegArg ? Number(cellDegArg.split("=")[1]) : 0.75;

const maxFetchArg = process.argv.find((a) => a.startsWith("--max-fetch="));
const maxFetch = maxFetchArg ? Number(maxFetchArg.split("=")[1]) : Infinity;

async function main() {
  let stationsOverride = null;
  let centroidsOverride = null;
  let tminOverride = null;

  const usTminPath = path.join(root, "data/ghcn/stations-us-tmin.json");
  if (fetchStations) {
    console.log("Building US GHCN TMIN station pool…");
    const { pool, inventoryIds, stationCount } = await buildUsTminStationPool();
    stationsOverride = pool;
    console.log(`Station pool: ${stationCount} (from ${inventoryIds} inventory TMIN rows)`);
    if (write) {
      fs.writeFileSync(usTminPath, JSON.stringify(pool) + "\n");
      console.log(`Wrote ${usTminPath}`);
    }
  } else if (full && fs.existsSync(usTminPath)) {
    stationsOverride = loadJson(root, "data/ghcn/stations-us-tmin.json");
    console.log(`Loaded ${stationsOverride.length} US TMIN stations`);
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

  const tminPath = path.join(root, "data/ghcn/tmin-frost-summaries.json");
  const legacyPath = path.join(root, "data/ghcn/tmin-parsed.json");
  let existingTmin = {};
  if (fs.existsSync(tminPath)) {
    existingTmin = normalizeTminCache(loadJson(root, "data/ghcn/tmin-frost-summaries.json"));
  } else if (fs.existsSync(legacyPath)) {
    existingTmin = normalizeTminCache(loadJson(root, "data/ghcn/tmin-parsed.json"));
  }

  if (
    fetchDailyNeeded ||
    fetchDailyRepresentative ||
    fetchDaily ||
    refetchMissingFall
  ) {
    const stationPool =
      stationsOverride ??
      (fs.existsSync(usTminPath) ? loadJson(root, "data/ghcn/stations-us-tmin.json") : null) ??
      loadJson(root, "data/ghcn/stations.json");

    let idsToFetch;
    if (refetchMissingFall) {
      const climatePath = path.join(root, "data/zipClimate.json");
      const used = fs.existsSync(climatePath)
        ? [
            ...new Set(
              Object.values(loadJson(root, "data/zipClimate.json")).map((r) => r.stationId),
            ),
          ]
        : stationPool.map((s) => s.id);
      idsToFetch = used.filter((id) => !stationHasFallFrostTmin(id, existingTmin));
      console.log(
        `Refetch missing fall frost: ${idsToFetch.length}/${used.length} stations`,
      );
    } else if (fetchDailyRepresentative) {
      const reps = selectRepresentativeStations(stationPool, cellDeg);
      idsToFetch = reps.map((s) => s.id).filter((id) => !stationHasFrostInCache(id, existingTmin));
      console.log(
        `Representative grid ${cellDeg}°: fetch TMIN for ${idsToFetch.length}/${reps.length} stations`,
      );
    } else if (fetchDailyNeeded && centroidsOverride) {
      const fixtureCentroids = loadJson(root, "data/zipCentroids.json");
      const centroids = { ...fixtureCentroids, ...centroidsOverride };
      const needed = computeNeededStationIds(centroids, stationPool, existingTmin);
      idsToFetch = needed.filter((id) => !stationHasFrostInCache(id, existingTmin));
      console.log(`Need TMIN for ${idsToFetch.length} stations (${stationPool.length} in pool)`);
    } else {
      idsToFetch = stationPool.map((s) => s.id);
      console.log(`Fetching GHCN-Daily TMIN for ${idsToFetch.length} stations…`);
    }

    if (Number.isFinite(maxFetch) && idsToFetch.length > maxFetch) {
      console.log(`Capping fetch to --max-fetch=${maxFetch}`);
      idsToFetch = idsToFetch.slice(0, maxFetch);
    }

    const fetched = await fetchBundledStationTmin(idsToFetch, {
      concurrency: 8,
      seed: existingTmin,
      requireFall: refetchMissingFall,
      batchSize: 40,
      onProgress: (id, status) => {
        if (status === "ok") process.stdout.write(`  ✓ ${id}\n`);
        else process.stderr.write(`  skip ${id}: ${status}\n`);
      },
      onBatch: write
        ? async (cache, done, remaining) => {
            fs.writeFileSync(tminPath, JSON.stringify(cache, null, 2) + "\n");
            console.log(`  checkpoint ${done} fetched, ~${remaining} remaining`);
          }
        : undefined,
    });
    tminOverride = mergeTminCaches(existingTmin, fetched);
    if (write) {
      fs.writeFileSync(tminPath, JSON.stringify(tminOverride, null, 2) + "\n");
      console.log(`Wrote ${tminPath} (${Object.keys(tminOverride).length} stations)`);
    }
  } else if (fs.existsSync(tminPath) || fs.existsSync(legacyPath)) {
    tminOverride = existingTmin;
  }

  const dataVersion = `ghcn-${new Date().toISOString().slice(0, 10)}`;
  const { output, skipped, manifest, stationCount, zipCount } = buildZipClimate(root, {
    stationsOverride,
    centroidsOverride,
    tminOverride,
    full,
    dataVersion,
    provenance:
      fetchDaily || fetchDailyNeeded || fetchDailyRepresentative || refetchMissingFall
        ? "NOAA GHCN-Daily parsed TMIN"
        : "NOAA GHCN-Daily nearest-station median",
  });

  const rows = Object.values(output);
  console.log(`Built ${zipCount} ZIP records from ${stationCount} stations`);
  console.log(
    `Coverage: zone ${(manifest.zoneFillRate * 100).toFixed(1)}%, ` +
      `median ${manifest.medianDistanceKm}km, p95 ${manifest.p95DistanceKm}km`,
  );
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

  const writeClimate =
    write &&
    (full ||
      (!fetchStations &&
        !fetchCentroids &&
        !fetchDaily &&
        !fetchDailyNeeded &&
        !fetchDailyRepresentative &&
        !refetchMissingFall));

  if (writeClimate) {
    const outPath = path.join(root, "data/zipClimate.json");
    fs.writeFileSync(outPath, JSON.stringify(output) + "\n");
    const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
    console.log(`\nWrote ${outPath} (${mb} MB, ${zipCount} ZIPs)`);

    const manifestPath = path.join(root, "data/climate-manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Wrote ${manifestPath}`);
  } else if (write && !writeClimate) {
    console.log("Skipped climate write (use --full --write to update zipClimate.json)");
  }
}

function stationHasFrostInCache(id, tminByStation) {
  const data = tminByStation[id];
  if (!data) return false;
  if (Array.isArray(data)) return data.length > 0;
  return false;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
