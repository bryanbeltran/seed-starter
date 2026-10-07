#!/usr/bin/env node
/**
 * Register Census 2010 county points used to sample BONAP county-map PNGs.
 *
 * The default selection is every county intersecting a ZCTA whose candidate
 * catalog is an explicitly labelled regional fallback.  Exact-ZCTA catalogs
 * already have complete USDA county claims; fallback counties are the BONAP
 * coverage gap this registration is intended to review.
 *
 *   node scripts/register-bonap-county-maps.mjs --shp /path/to/counties.shp
 *   node scripts/register-bonap-county-maps.mjs --shp /path/to/counties.shp --write
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import shapefile from "shapefile";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const countyDataPath = path.join(root, "data/natives/zip-county.json");
const catalogPath = path.join(root, "data/natives/zcta-catalog.json");
const existingRegistrationPath = path.join(root, "data/natives/bonap-county-map-registration.json");
const outputPath = existingRegistrationPath;
const CENSUS_COUNTY_SOURCE_URL =
  "https://www2.census.gov/geo/tiger/GENZ2010/gz_2010_us_050_00_500k.zip";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function ringCentroid(ring) {
  let signedArea = 0;
  let centroidX = 0;
  let centroidY = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [previousX, previousY] = ring[previous] ?? [];
    const [currentX, currentY] = ring[index] ?? [];
    if (![previousX, previousY, currentX, currentY].every(Number.isFinite)) return null;
    const cross = previousX * currentY - currentX * previousY;
    signedArea += cross;
    centroidX += (previousX + currentX) * cross;
    centroidY += (previousY + currentY) * cross;
  }
  if (Math.abs(signedArea) < 1e-12) return null;
  return {
    area: Math.abs(signedArea) / 2,
    longitude: centroidX / (3 * signedArea),
    latitude: centroidY / (3 * signedArea),
  };
}

/** Match the prior registration method: centroid of the largest outer ring. */
export function largestOuterPolygonCentroid(geometry) {
  const polygons = geometry?.type === "Polygon"
    ? [geometry.coordinates]
    : geometry?.type === "MultiPolygon"
      ? geometry.coordinates
      : [];
  let largest = null;
  for (const polygon of polygons) {
    for (const ring of polygon ?? []) {
      const centroid = ringCentroid(ring);
      if (centroid && (!largest || centroid.area > largest.area)) largest = centroid;
    }
  }
  if (!largest) return null;
  return {
    longitude: largest.longitude,
    latitude: largest.latitude,
  };
}

export function fallbackCountyFipses({ countyData, catalog }) {
  const fipses = new Set();
  let fallbackZctaCount = 0;
  for (const [zcta, entry] of Object.entries(catalog.zctas ?? {})) {
    if (!String(entry.mappingBasis ?? "").includes("fallback")) continue;
    fallbackZctaCount++;
    for (const intersection of countyData.intersections?.[zcta] ?? []) {
      if (/^[0-9]{5}$/.test(intersection.fips ?? "")) fipses.add(intersection.fips);
    }
  }
  return { fipses, fallbackZctaCount };
}

export async function buildBonapCountyRegistration({
  shapefilePath,
  countyData,
  catalog,
  existing,
}) {
  const { fipses, fallbackZctaCount } = fallbackCountyFipses({ countyData, catalog });
  const source = await shapefile.open(shapefilePath);
  const counties = new Map();
  while (true) {
    const row = await source.read();
    if (row.done) break;
    const properties = row.value?.properties ?? {};
    const countyFips = `${properties.STATE ?? ""}${properties.COUNTY ?? ""}`;
    if (!fipses.has(countyFips)) continue;
    const point = largestOuterPolygonCentroid(row.value.geometry);
    if (!point) throw new Error(`Census geometry has no usable centroid for county ${countyFips}`);
    counties.set(countyFips, point);
  }
  const missing = [...fipses].filter((fips) => !counties.has(fips)).sort();
  if (missing.length > 0) {
    throw new Error(`Census county geometry omitted registered FIPS: ${missing.join(", ")}`);
  }
  return {
    version: "2",
    provenance:
      "Representative points are the largest-part area centroids of the affected Census 2010 generalized county polygons, used only to sample the county fill in BONAP's raster map. County-to-ZCTA assignment remains the published Census 2010 ZCTA/county intersection artifact; these points do not replace that geography join.",
    source: {
      name: "U.S. Census Bureau 2010 generalized county polygons",
      url: CENSUS_COUNTY_SOURCE_URL,
      geography: "Census 2010 county or county-equivalent",
      geometryMethod: "largest outer polygon area centroid",
      crs: "EPSG:4269",
    },
    selection: {
      kind: "zcta_catalog_fallback_intersections",
      fallbackZctaCount,
      countyCount: counties.size,
      mappingBases: [
        "epa_l3_catalog_fallback_when_no_complete_zcta_native_intersection",
        "nearest_zcta_epa_l3_catalog_fallback_centroid_outside_epa_polygon",
      ],
    },
    projection: existing.projection,
    sampling: existing.sampling,
    counties: Object.fromEntries([...counties.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
}

async function main() {
  const shapefilePath = argumentValue("--shp") ?? process.env.BONAP_COUNTY_SHP_PATH;
  if (!shapefilePath) {
    throw new Error("Pass --shp /path/to/gz_2010_us_050_00_500k.shp or set BONAP_COUNTY_SHP_PATH");
  }
  const registration = await buildBonapCountyRegistration({
    shapefilePath,
    countyData: readJson(countyDataPath),
    catalog: readJson(catalogPath),
    existing: readJson(existingRegistrationPath),
  });
  console.log(JSON.stringify({
    fallbackZctaCount: registration.selection.fallbackZctaCount,
    countyCount: registration.selection.countyCount,
    source: registration.source.url,
  }, null, 2));
  if (process.argv.includes("--write")) {
    fs.writeFileSync(outputPath, `${JSON.stringify(registration, null, 2)}\n`);
    console.log(`wrote ${outputPath}`);
  }
  return registration;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
