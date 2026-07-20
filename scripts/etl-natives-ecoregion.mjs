#!/usr/bin/env node
/**
 * ETL: ZCTA centroids × EPA Level III ecoregions → data/natives/zip-ecoregion.json
 *
 *   pnpm run etl:natives-ecoregion -- --write
 *   pnpm run etl:natives-ecoregion -- --fetch-centroids --write
 *
 * Inputs (cached under data/.cache/): EPA us_eco_l3 shapefile, optional zctaCentroids.
 * Output only: compact { [zip]: { id, name } } — no polygons shipped.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { open as openShapefile } from "shapefile";
import pointInPolygon from "point-in-polygon";
import proj4 from "proj4";
import { fetchZctaCentroids } from "./lib/ghcn-zip-climate.mjs";

/** EPA L3 shapefile CRS (USA Contiguous Albers Equal Area Conic, USGS). */
const EPA_ALBERS =
  "+proj=aea +lat_1=29.5 +lat_2=45.5 +lat_0=23 +lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs";
const WGS84 = "EPSG:4326";

function toAlbers(lon, lat) {
  return proj4(WGS84, EPA_ALBERS, [lon, lat]);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "data/.cache");
const outPath = path.join(root, "data/natives/zip-ecoregion.json");
const write = process.argv.includes("--write");
const fetchCentroids = process.argv.includes("--fetch-centroids");

/** EPA ORD ecoregions — Level III without state boundaries. */
const EPA_L3_ZIP_URL =
  process.env.EPA_L3_ZIP_URL ??
  "https://dmap-prod-oms-edc.s3.us-east-1.amazonaws.com/ORD/Ecoregions/us/us_eco_l3.zip";

function loadCentroids() {
  const fullPath = path.join(root, "data/zctaCentroids.json");
  const fixturePath = path.join(root, "data/zipCentroids.json");
  if (fs.existsSync(fullPath)) {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  }
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

async function ensureEpaShapefile() {
  const shpPath = path.join(cacheDir, "us_eco_l3.shp");
  if (fs.existsSync(shpPath)) return shpPath;

  fs.mkdirSync(cacheDir, { recursive: true });
  const zipPath = path.join(cacheDir, "us_eco_l3.zip");
  console.log(`Fetching EPA L3: ${EPA_L3_ZIP_URL}`);
  const res = await fetch(EPA_L3_ZIP_URL);
  if (!res.ok) throw new Error(`EPA L3 download failed: ${res.status}`);
  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  execSync(`unzip -o -q "${zipPath}" -d "${cacheDir}"`);
  if (!fs.existsSync(shpPath)) {
    const shp = fs.readdirSync(cacheDir).find((f) => f.endsWith(".shp") && /l3/i.test(f));
    if (!shp) throw new Error("No Level III .shp found after unzip");
    return path.join(cacheDir, shp);
  }
  return shpPath;
}

function ringsFromGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((poly) => poly[0]);
  }
  return [];
}

function bboxOfRing(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

async function loadEcoregions(shpPath) {
  const source = await openShapefile(shpPath);
  const regions = [];
  for (;;) {
    const { done, value } = await source.read();
    if (done) break;
    const props = value.properties ?? {};
    const id = String(props.US_L3CODE ?? props.us_l3code ?? props.NA_L3CODE ?? "").trim();
    const name = String(props.US_L3NAME ?? props.us_l3name ?? props.NA_L3NAME ?? id).trim();
    if (!id) continue;
    const rings = ringsFromGeometry(value.geometry);
    for (const ring of rings) {
      regions.push({ id, name, ring, bbox: bboxOfRing(ring) });
    }
  }
  return regions;
}

function findEcoregion(lon, lat, regions) {
  const [x, y] = toAlbers(lon, lat);
  for (const r of regions) {
    const { minX, minY, maxX, maxY } = r.bbox;
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    if (pointInPolygon([x, y], r.ring)) return { id: r.id, name: r.name };
  }
  return null;
}

async function main() {
  if (fetchCentroids) {
    const centroids = await fetchZctaCentroids(cacheDir);
    const centroidsPath = path.join(root, "data/zctaCentroids.json");
    fs.writeFileSync(centroidsPath, JSON.stringify(centroids) + "\n");
    console.log(`Wrote ${centroidsPath} (${Object.keys(centroids).length} ZIPs)`);
  }

  const centroids = loadCentroids();
  const shpPath = await ensureEpaShapefile();
  console.log(`Loading ecoregions from ${shpPath}`);
  const regions = await loadEcoregions(shpPath);
  console.log(`Loaded ${regions.length} polygon rings`);

  const zips = {};
  const names = {};
  let hit = 0;
  let miss = 0;
  for (const [zip, c] of Object.entries(centroids)) {
    const found = findEcoregion(c.lon, c.lat, regions);
    if (found) {
      zips[zip] = found.id;
      names[found.id] = found.name;
      hit++;
    } else {
      miss++;
    }
  }

  const payload = {
    version: "epa-l3-2013",
    provenance:
      "ZCTA centroid × EPA Level III ecoregions (US public domain). See ADR 007.",
    generatedAt: new Date().toISOString().slice(0, 10),
    zipCount: Object.keys(zips).length,
    missCount: miss,
    names,
    zips,
  };

  console.log(`Matched ${hit} ZIPs; missed ${miss}`);
  if (zips["55423"]) {
    console.log(`55423 → ${zips["55423"]} ${names[zips["55423"]]}`);
  }

  if (!write) {
    console.log("Dry run — pass --write to save", outPath);
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload) + "\n");
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
