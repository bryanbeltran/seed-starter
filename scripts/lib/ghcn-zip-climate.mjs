import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const GHCND_STATIONS_URL =
  "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt";

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestStation(centroid, stations) {
  let best = null;
  let bestKm = Infinity;
  for (const s of stations) {
    const km = haversineKm(centroid, s);
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
  }
  return { station: best, distanceKm: Math.round(bestKm * 10) / 10 };
}

export function lastFrostMmDdPerYear(stationId, tminByStation) {
  const byYear = tminByStation[stationId];
  if (!byYear) return [];

  const results = [];
  for (const [year, rows] of Object.entries(byYear)) {
    let lastFrost = null;
    for (const [mm, dd, tmin] of rows) {
      if (Number(mm) > 7) continue;
      if (tmin < 0) lastFrost = `${mm}-${dd}`;
    }
    if (lastFrost) results.push({ year: Number(year), lastFrost });
  }
  return results;
}

function medianMmDd(mmddList) {
  const doys = mmddList.map((s) => {
    const [m, d] = s.split("-").map(Number);
    return new Date(2024, m - 1, d);
  });
  doys.sort((a, b) => a - b);
  const mid = doys[Math.floor(doys.length / 2)];
  const mm = String(mid.getMonth() + 1).padStart(2, "0");
  const dd = String(mid.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

export function frostPercentiles(byYear) {
  const dates = byYear.map((r) => r.lastFrost).sort();
  const pick = (p) =>
    dates[Math.min(dates.length - 1, Math.floor(p * (dates.length - 1)))];
  return {
    p10: pick(0.1),
    p50: medianMmDd(dates),
    p90: pick(0.9),
  };
}

export function parseGhcndStations(text) {
  const stations = [];
  for (const line of text.split("\n")) {
    if (line.length < 30) continue;
    const id = line.slice(0, 11).trim();
    if (!id.startsWith("US")) continue;
    const lat = Number(line.slice(12, 20));
    const lon = Number(line.slice(21, 30));
    const name = line.slice(31, 71).trim() || id;
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    stations.push({ id, name, lat, lon });
  }
  return stations;
}

export async function fetchGhcndStations() {
  const res = await fetch(GHCND_STATIONS_URL);
  if (!res.ok) {
    throw new Error(`GHCN station download failed: ${res.status}`);
  }
  return parseGhcndStations(await res.text());
}

export const ZCTA_GAZETTEER_ZIP_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip";

export const ghcndDailyUrl = (stationId) =>
  `https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/${stationId}.dly`;

export function loadJson(root, relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

export function parseZctaGazetteer(text) {
  const lines = text.trim().split("\n");
  const centroids = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const zip = cols[0]?.padStart(5, "0");
    const lat = Number(cols[cols.length - 2]);
    const lon = Number(cols[cols.length - 1]);
    if (!zip || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    centroids[zip] = { lat, lon };
  }
  return centroids;
}

export async function fetchZctaCentroids(cacheDir) {
  const res = await fetch(ZCTA_GAZETTEER_ZIP_URL);
  if (!res.ok) throw new Error(`ZCTA gazetteer download failed: ${res.status}`);
  fs.mkdirSync(cacheDir, { recursive: true });
  const zipPath = path.join(cacheDir, "zcta.zip");
  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  execSync(`unzip -o -q "${zipPath}" -d "${cacheDir}"`);
  const txtPath = path.join(cacheDir, "2020_Gaz_zcta_national.txt");
  if (!fs.existsSync(txtPath)) {
    throw new Error(`Expected ${txtPath} after unzip`);
  }
  return parseZctaGazetteer(fs.readFileSync(txtPath, "utf8"));
}

/** Parse GHCN-Daily monthly .dly rows (TMIN) into spike-compatible year map. */
export function parseGhcndDailyTmin(text) {
  const byYear = {};
  for (const line of text.split("\n")) {
    if (line.length < 27) continue;
    const element = line.slice(17, 21).trim();
    if (element !== "TMIN") continue;
    const year = line.slice(11, 15).trim();
    const month = line.slice(15, 17).trim();
    if (Number(month) > 7) continue;
    if (!byYear[year]) byYear[year] = [];

    for (let day = 1, pos = 21; day <= 31 && pos + 5 <= line.length; day++) {
      const raw = Number(line.slice(pos, pos + 5).trim());
      pos += 6;
      if (Number.isNaN(raw) || raw <= -9000) continue;
      const tmin = raw / 10;
      const dd = String(day).padStart(2, "0");
      byYear[year].push([month, dd, tmin]);
    }
  }
  return byYear;
}

export async function fetchStationTmin(stationId) {
  const res = await fetch(ghcndDailyUrl(stationId));
  if (!res.ok) throw new Error(`GHCN daily fetch failed for ${stationId}: ${res.status}`);
  return parseGhcndDailyTmin(await res.text());
}

export async function fetchBundledStationTmin(stationIds) {
  const tminByStation = {};
  for (const id of stationIds) {
    try {
      tminByStation[id] = await fetchStationTmin(id);
      console.log(`  fetched TMIN: ${id}`);
    } catch (err) {
      console.warn(`  skip ${id}: ${err.message}`);
    }
  }
  return tminByStation;
}

export function buildZipClimate(root, options = {}) {
  const {
    dataVersion = `ghcn-${new Date().toISOString().slice(0, 10)}`,
    provenance = "NOAA GHCN-Daily nearest-station median",
    stationsPath = "data/ghcn/stations.json",
    tminPath = "data/ghcn/tmin-samples.json",
    centroidsPath = "data/zipCentroids.json",
    zonesPath = "data/zipZones.json",
    stationsOverride = null,
    centroidsOverride = null,
    tminOverride = null,
    full = false,
  } = options;

  const stations = stationsOverride ?? loadJson(root, stationsPath);
  const tminByStation = tminOverride ?? loadJson(root, tminPath);
  const fixtureCentroids = loadJson(root, "data/zipCentroids.json");
  const centroids = {
    ...fixtureCentroids,
    ...(centroidsOverride ?? loadJson(root, centroidsPath)),
  };
  const zipZones = loadJson(root, zonesPath);
  const spikeSample = loadJson(root, "data/spike/zipClimate-sample.json");

  const output = {};
  const skipped = [];

  const zipEntries = full
    ? Object.keys(centroids).map((zip) => [zip, zipZones[zip] ?? ""])
    : Object.entries(zipZones);

  for (const [zip, zone] of zipEntries) {
    const centroid = centroids[zip];
    if (!centroid) {
      skipped.push(zip);
      continue;
    }

    const { station, distanceKm } = nearestStation(centroid, stations);
    const byYear = lastFrostMmDdPerYear(station.id, tminByStation);
    if (!byYear.length) {
      skipped.push(zip);
      continue;
    }

    const percentiles = frostPercentiles(byYear);
    output[zip] = {
      zip,
      zone: zone || undefined,
      stationId: station.id,
      stationName: station.name,
      distanceKm,
      lastFrostP10: percentiles.p10,
      lastFrostP50: percentiles.p50,
      lastFrostP90: percentiles.p90,
      yearsSampled: byYear.length,
      provenance,
      dataVersion,
      method: "nearest-station-median",
      computedAt: new Date().toISOString(),
    };
  }

  for (const zip of Object.keys(zipZones)) {
    if (!output[zip] && spikeSample[zip]) {
      output[zip] = { ...spikeSample[zip], computedAt: new Date().toISOString() };
    }
  }

  return {
    output,
    skipped,
    stationCount: stations.length,
    zipCount: Object.keys(output).length,
  };
}
