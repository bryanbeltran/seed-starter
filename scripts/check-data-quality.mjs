import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

const zipZones = readJson("data/zipZones.json");
const zipClimate = readJson("data/zipClimate.json");
const phzmZones = fs.existsSync(path.join(root, "data/zipZones-phzm.json"))
  ? readJson("data/zipZones-phzm.json")
  : {};
const zipCentroids = readJson("data/zipCentroids.json");
const stationFrost = readJson("src/planning/data/stationFrost.json");
const regionalFrost = readJson("src/planning/data/regionalFrost.json");
const frostDates = readJson("src/planning/frostDates.json");

const errors = [];

if (Object.keys(zipZones).length < 10) {
  errors.push("zipZones fixture should include at least 10 ZIP codes");
}

for (const [zip, zone] of Object.entries(zipZones)) {
  if (!/^\d{5}$/.test(zip)) errors.push(`invalid zip key: ${zip}`);
  if (!zone) errors.push(`missing zone for zip ${zip}`);
}

for (const record of Object.values(stationFrost)) {
  if (!record.lastFrost || !record.zips?.length) {
    errors.push("station frost records need zips and lastFrost");
  }
}

for (const record of Object.values(regionalFrost)) {
  if (!record.lastFrost || !record.zones?.length) {
    errors.push("regional frost records need zones and lastFrost");
  }
}

if (Object.keys(frostDates).length < 10) {
  errors.push("frostDates should cover at least 10 zones");
}

const mmdd = /^\d{2}-\d{2}$/;
for (const [zip, record] of Object.entries(zipClimate)) {
  if (!/^\d{5}$/.test(zip)) errors.push(`invalid zipClimate key: ${zip}`);
  for (const field of ["lastFrostP10", "lastFrostP50", "lastFrostP90"]) {
    if (!mmdd.test(record[field])) {
      errors.push(`zipClimate ${zip}: invalid ${field}`);
    }
  }
  if (!record.dataVersion) errors.push(`zipClimate ${zip}: missing dataVersion`);
}

const climateZips = new Set(Object.keys(zipClimate));
const fixtureZips = Object.keys(zipZones);
const missingClimate = fixtureZips.filter((z) => !climateZips.has(z));
if (missingClimate.length) {
  errors.push(`zipClimate missing fixture zips: ${missingClimate.join(", ")}`);
}

for (const zip of fixtureZips) {
  if (!zipCentroids[zip]) {
    errors.push(`zipCentroids missing fixture zip: ${zip}`);
  }
}

if (Object.keys(phzmZones).length < 30_000) {
  errors.push(`zipZones-phzm should include at least 30k ZIP codes`);
}

if (errors.length) {
  console.error("Data quality check failed:\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}

console.log("Data quality checks passed.");
