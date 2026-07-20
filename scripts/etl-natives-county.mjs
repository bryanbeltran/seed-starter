#!/usr/bin/env node
/**
 * ETL: ZCTA → primary county (FIPS + name) for natives county overlay.
 *
 *   pnpm run etl:natives-county -- --write
 *   pnpm run etl:natives-county -- --fetch --write
 *
 * Sources: Census ZCTA-county relationship (2010) + county gazetteer.
 * Output: compact data/natives/zip-county.json
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "data/.cache");
const outPath = path.join(root, "data/natives/zip-county.json");
const write = process.argv.includes("--write");
const fetchRemote = process.argv.includes("--fetch");

const REL_URL =
  process.env.ZCTA_COUNTY_REL_URL ??
  "https://www2.census.gov/geo/docs/maps-data/data/rel/zcta_county_rel_10.txt";
const GAZ_URL =
  process.env.COUNTY_GAZ_URL ??
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2021_Gazetteer/2021_Gaz_counties_national.zip";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function download(url, dest) {
  console.log(`fetch ${url}`);
  execSync(`curl -fsSL -o "${dest}" "${url}"`, { stdio: "inherit" });
}

function loadCountyNames() {
  const gazTxt = path.join(cacheDir, "gaz_counties_national.txt");
  const gazZip = path.join(cacheDir, "gaz_counties_national.zip");
  if (!fs.existsSync(gazTxt)) {
    if (!fs.existsSync(gazZip)) {
      if (!fetchRemote) {
        throw new Error("Missing gazetteer cache; re-run with --fetch");
      }
      download(GAZ_URL, gazZip);
    }
    execSync(`unzip -o -d "${cacheDir}" "${gazZip}"`, { stdio: "inherit" });
    const extracted = fs
      .readdirSync(cacheDir)
      .find((f) => f.includes("Gaz_counties") && f.endsWith(".txt"));
    if (!extracted) throw new Error("Gazetteer txt not found after unzip");
    fs.renameSync(path.join(cacheDir, extracted), gazTxt);
  }

  const names = {};
  const lines = fs.readFileSync(gazTxt, "utf8").split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split("\t");
    const state = cols[0]?.trim();
    const geoid = cols[1]?.trim();
    const name = cols[3]?.trim().replace(/ County$/, "");
    if (geoid && state && name) {
      names[geoid] = { name, state };
    }
  }
  return names;
}

function buildPrimaryCounties(countyNames) {
  const relPath = path.join(cacheDir, "zcta_county_rel_10.txt");
  if (!fs.existsSync(relPath)) {
    if (!fetchRemote) {
      throw new Error("Missing ZCTA-county rel cache; re-run with --fetch");
    }
    download(REL_URL, relPath);
  }

  const best = new Map(); // zip → { fips, pct }
  const lines = fs.readFileSync(relPath, "utf8").split(/\r?\n/);
  const header = lines[0].split(",");
  const iZcta = header.indexOf("ZCTA5");
  const iState = header.indexOf("STATE");
  const iCounty = header.indexOf("COUNTY");
  const iPct = header.indexOf("ZPOPPCT");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split(",");
    const zip = cols[iZcta];
    const state = cols[iState]?.padStart(2, "0");
    const county = cols[iCounty]?.padStart(3, "0");
    const pct = Number(cols[iPct] ?? 0);
    if (!/^\d{5}$/.test(zip) || !state || !county) continue;
    const fips = `${state}${county}`;
    const prev = best.get(zip);
    if (!prev || pct > prev.pct) best.set(zip, { fips, pct });
  }

  const zips = {};
  const counties = {};
  let missingName = 0;
  for (const [zip, { fips }] of best) {
    zips[zip] = fips;
    if (!counties[fips]) {
      const meta = countyNames[fips];
      if (!meta) {
        missingName++;
        counties[fips] = { name: `County ${fips.slice(2)}`, state: "??" };
      } else {
        counties[fips] = meta;
      }
    }
  }
  return { zips, counties, missingName, zipCount: Object.keys(zips).length };
}

ensureDir(cacheDir);
const countyNames = loadCountyNames();
const { zips, counties, missingName, zipCount } = buildPrimaryCounties(countyNames);

const out = {
  version: "census-zcta-county-rel-2010",
  provenance:
    "Census ZCTA-county relationship (max ZPOPPCT) + 2021 county gazetteer. Overlay only — nativity remains EPA L3.",
  zips,
  counties,
};

console.log(
  `zips=${zipCount} counties=${Object.keys(counties).length} missingNames=${missingName}`,
);

if (write) {
  fs.writeFileSync(outPath, `${JSON.stringify(out)}\n`);
  console.log(`wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
} else {
  console.log("dry-run (pass --write to save)");
}
