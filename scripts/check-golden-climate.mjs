import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function doy(mmdd) {
  const [m, d] = mmdd.split("-").map(Number);
  return Math.floor(
    (Date.UTC(2024, m - 1, d) - Date.UTC(2024, 0, 0)) / 86_400_000,
  );
}

const golden = readJson("data/golden-zips.json");
const climate = readJson("data/zipClimate.json");
const errors = [];

for (const entry of golden.zips) {
  const record = climate[entry.zip];
  if (!record) {
    errors.push(`${entry.zip}: missing from zipClimate`);
    continue;
  }
  if (record.distanceKm > entry.maxDistanceKm) {
    errors.push(
      `${entry.zip}: distance ${record.distanceKm}km > ${entry.maxDistanceKm}km`,
    );
  }
  const delta = Math.abs(doy(record.lastFrostP50) - doy(entry.p50));
  if (delta > golden.toleranceDays) {
    errors.push(
      `${entry.zip}: p50 ${record.lastFrostP50} vs expected ${entry.p50} (Δ${delta}d > ${golden.toleranceDays}d)`,
    );
  }
}

if (errors.length) {
  console.error("Golden climate eval failed:\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}

console.log(`Golden climate OK: ${golden.zips.length} ZIPs within ±${golden.toleranceDays}d`);
