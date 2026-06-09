import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

const THRESHOLDS = {
  minZipCount: 30_000,
  maxSkipped: 800,
  minZoneFillRate: 0.95,
  maxP95DistanceKm: 80,
  minTminStations: 500,
};

const manifestPath = path.join(root, "data/climate-manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("Climate drift check failed: missing data/climate-manifest.json (run etl:climate --write)");
  process.exit(1);
}

const m = readJson("data/climate-manifest.json");
const errors = [];

if (m.zipCount < THRESHOLDS.minZipCount) {
  errors.push(`zipCount ${m.zipCount} < ${THRESHOLDS.minZipCount}`);
}
if (m.skippedCount > THRESHOLDS.maxSkipped) {
  errors.push(`skippedCount ${m.skippedCount} > ${THRESHOLDS.maxSkipped}`);
}
if (m.zoneFillRate < THRESHOLDS.minZoneFillRate) {
  errors.push(`zoneFillRate ${(m.zoneFillRate * 100).toFixed(1)}% < ${THRESHOLDS.minZoneFillRate * 100}%`);
}
if (m.p95DistanceKm > THRESHOLDS.maxP95DistanceKm) {
  errors.push(`p95DistanceKm ${m.p95DistanceKm} > ${THRESHOLDS.maxP95DistanceKm}`);
}
if (m.tminStationCount < THRESHOLDS.minTminStations) {
  errors.push(`tminStationCount ${m.tminStationCount} < ${THRESHOLDS.minTminStations}`);
}

if (errors.length) {
  console.error("Climate drift check failed:\n" + errors.map((e) => `- ${e}`).join("\n"));
  console.error("\nManifest:", JSON.stringify(m, null, 2));
  process.exit(1);
}

console.log(
  `Climate drift OK: ${m.zipCount} ZIPs, ${m.tminStationCount} TMIN stations, ` +
    `zone ${(m.zoneFillRate * 100).toFixed(1)}%, p95 ${m.p95DistanceKm}km`,
);
