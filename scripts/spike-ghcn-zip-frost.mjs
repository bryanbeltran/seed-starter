#!/usr/bin/env node
/** Thin wrapper — defers to shared ETL lib. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildZipClimate } from "./lib/ghcn-zip-climate.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");

const { output } = buildZipClimate(root, {
  dataVersion: "spike-2026-06",
  provenance: "NOAA GHCN-Daily (spike sample)",
});

const rows = Object.values(output);
console.log("ZIP → nearest GHCN station → last frost percentiles\n");
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
  const outDir = path.join(root, "data/spike");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "zipClimate-sample.json"),
    JSON.stringify(output, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(root, "data/zipClimate.json"),
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log("\nWrote data/zipClimate.json");
}
