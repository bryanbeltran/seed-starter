#!/usr/bin/env node
/**
 * ETL: Census ZCTA/county intersections plus a primary county overlay.
 *
 *   pnpm run etl:natives-county -- --write
 *   pnpm run etl:natives-county -- --fetch --write
 *
 * The 2010 relationship file and 2021 county gazetteer have different
 * geography vintages. Preserve the relationship file's state and county FIPS
 * as supplied; a missing gazetteer name stays unresolved instead of being
 * guessed from a FIPS prefix.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "data/.cache");
const outPath = path.join(root, "data/natives/zip-county.json");
const write = process.argv.includes("--write");
const fetchRemote = process.argv.includes("--fetch");

export const REL_URL =
  process.env.ZCTA_COUNTY_REL_URL ??
  "https://www2.census.gov/geo/docs/maps-data/data/rel/zcta_county_rel_10.txt";
export const GAZ_URL =
  process.env.COUNTY_GAZ_URL ??
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2021_Gazetteer/2021_Gaz_counties_national.zip";

const STATE_BY_FIPS = {
  "01": "AL", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "12": "FL", "13": "GA", "16": "ID",
  "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI",
  "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY",
  "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR",
  "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN",
  "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY",
};

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function download(url, destination) {
  console.log(`fetch ${url}`);
  execFileSync("curl", ["-fsSL", "-o", destination, url], {
    stdio: "inherit",
  });
}

export function parseCountyGazetteer(text) {
  const names = {};
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split("\t");
    const state = cols[0]?.trim();
    const geoid = cols[1]?.trim();
    const name = cols[3]?.trim().replace(/ County$/, "");
    if (geoid && state && name) names[geoid] = { name, state };
  }
  return names;
}

export function buildCountyData(relationshipText, countyNames, options = {}) {
  const lines = relationshipText.split(/\r?\n/);
  const header = lines[0]?.split(",").map((value) => value.trim());
  if (!header?.length) throw new Error("Census relationship file has no header");

  const column = (name) => header.indexOf(name);
  const iZip = column("ZCTA5");
  const iState = column("STATE");
  const iCounty = column("COUNTY");
  const iPopulationShare = column("ZPOPPCT");
  if ([iZip, iState, iCounty, iPopulationShare].some((index) => index < 0)) {
    throw new Error("Census relationship file is missing required columns");
  }

  const byZip = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split(",");
    const zip = cols[iZip]?.trim();
    const stateFips = cols[iState]?.trim().padStart(2, "0");
    const countyCode = cols[iCounty]?.trim().padStart(3, "0");
    const populationShare = Number(cols[iPopulationShare]);
    if (
      !/^\d{5}$/.test(zip ?? "") ||
      !/^\d{2}$/.test(stateFips ?? "") ||
      !/^\d{3}$/.test(countyCode ?? "") ||
      !Number.isFinite(populationShare)
    ) {
      throw new Error(`Invalid Census ZCTA/county relationship at line ${i + 1}`);
    }

    const fips = `${stateFips}${countyCode}`;
    const intersections = byZip.get(zip) ?? [];
    intersections.push({ fips, stateFips, populationShare });
    byZip.set(zip, intersections);
  }

  const zips = {};
  const intersections = {};
  const counties = {};
  let missingName = 0;
  for (const [zip, countyRows] of byZip) {
    countyRows.sort((a, b) => a.fips.localeCompare(b.fips));
    intersections[zip] = countyRows;

    const primary = countyRows.reduce((best, row) =>
      row.populationShare > best.populationShare ? row : best,
    );
    zips[zip] = primary.fips;

    for (const { fips, stateFips } of countyRows) {
      if (counties[fips]) continue;
      const gazetteer = countyNames[fips];
      if (gazetteer) {
        counties[fips] = gazetteer;
        continue;
      }

      missingName++;
      counties[fips] = {
        name: null,
        state: STATE_BY_FIPS[stateFips] ?? "??",
      };
    }
  }

  const data = {
    version: "census-zcta-county-rel-2010+gazetteer-2021",
    provenance:
      "All Census 2010 ZCTA-county intersections with the largest-ZPOPPCT county retained as the primary overlay; names from the 2021 Census county gazetteer. County IDs missing from that newer gazetteer remain unnamed, while state FIPS and county FIPS stay as published in the 2010 relationship file.",
    zips,
    intersections,
    counties,
  };
  validateCountyData(data, options);
  return { data, missingName, zipCount: Object.keys(zips).length };
}

export function validateCountyData(data, { minZipCount = 30_000 } = {}) {
  const zipEntries = Object.entries(data.zips ?? {});
  if (zipEntries.length < minZipCount) {
    throw new Error(`Only ${zipEntries.length} ZCTAs in Census county data`);
  }
  for (const [zip, primaryFips] of zipEntries) {
    if (!/^\d{5}$/.test(zip)) throw new Error(`Invalid ZCTA key ${zip}`);
    const rows = data.intersections?.[zip];
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`Missing county intersections for ZCTA ${zip}`);
    }
    if (!rows.some((row) => row.fips === primaryFips)) {
      throw new Error(`Primary county for ZCTA ${zip} is not an intersection`);
    }
    for (const row of rows) {
      if (!/^\d{5}$/.test(row.fips) || !/^\d{2}$/.test(row.stateFips)) {
        throw new Error(`Invalid county FIPS in ZCTA ${zip}`);
      }
    }
  }
}

function readCountyNames() {
  const gazTextPath = path.join(cacheDir, "gaz_counties_national.txt");
  const gazZipPath = path.join(cacheDir, "gaz_counties_national.zip");
  if (!fs.existsSync(gazTextPath)) {
    if (!fs.existsSync(gazZipPath)) {
      if (!fetchRemote) {
        throw new Error("Missing gazetteer cache; re-run with --fetch");
      }
      download(GAZ_URL, gazZipPath);
    }
    execFileSync("unzip", ["-o", "-d", cacheDir, gazZipPath], {
      stdio: "inherit",
    });
    const extracted = fs
      .readdirSync(cacheDir)
      .find((filename) => filename.includes("Gaz_counties") && filename.endsWith(".txt"));
    if (!extracted) throw new Error("County gazetteer text missing after unzip");
    fs.renameSync(path.join(cacheDir, extracted), gazTextPath);
  }
  return parseCountyGazetteer(fs.readFileSync(gazTextPath, "utf8"));
}

function readRelationships() {
  const relationPath = path.join(cacheDir, "zcta_county_rel_10.txt");
  if (!fs.existsSync(relationPath)) {
    if (!fetchRemote) {
      throw new Error("Missing ZCTA-county relationship cache; re-run with --fetch");
    }
    download(REL_URL, relationPath);
  }
  return fs.readFileSync(relationPath, "utf8");
}

function writeAtomically(destination, value) {
  const stagedPath = `${destination}.staged`;
  fs.writeFileSync(stagedPath, `${JSON.stringify(value)}\n`);
  try {
    fs.renameSync(stagedPath, destination);
  } catch (error) {
    fs.rmSync(stagedPath, { force: true });
    throw error;
  }
}

export function main() {
  ensureDir(cacheDir);
  const countyNames = readCountyNames();
  const { data, missingName, zipCount } = buildCountyData(
    readRelationships(),
    countyNames,
  );
  console.log(
    `zctas=${zipCount} countyFips=${Object.keys(data.counties).length} unnamedCountyFips=${missingName}`,
  );
  if (!write) {
    console.log("dry-run (pass --write to save)");
    return;
  }
  writeAtomically(outPath, data);
  console.log(`wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
