import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const GHCND_STATIONS_URL =
  "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt";
const GHCND_INVENTORY_URL =
  "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-inventory.txt";
export const PHZM_ZIP_CSV_URL =
  "https://prism.oregonstate.edu/phzm/data/2023/phzm_us_zipcode_2023.csv";

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

export function stationHasFrostTmin(stationId, tminByStation) {
  return lastFrostMmDdPerYear(stationId, tminByStation).length > 0;
}

export function normalizeTminCache(raw) {
  const out = {};
  for (const [id, data] of Object.entries(raw)) {
    out[id] = Array.isArray(data) ? data : frostSummaryFromParsedTmin(data);
  }
  return out;
}

/** Nearest station with parseable spring frost TMIN history. */
export function nearestStationWithTmin(centroid, stations, tminByStation) {
  let best = null;
  let bestKm = Infinity;
  for (const s of stations) {
    if (!stationHasFrostTmin(s.id, tminByStation)) continue;
    const km = haversineKm(centroid, s);
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
  }
  if (!best) return { station: null, distanceKm: null };
  return { station: best, distanceKm: Math.round(bestKm * 10) / 10 };
}

export function computeNeededStationIds(centroids, stations, tminByStation) {
  const needed = new Set();
  for (const centroid of Object.values(centroids)) {
    const { station } = nearestStation(centroid, stations);
    if (!station || stationHasFrostTmin(station.id, tminByStation)) continue;
    needed.add(station.id);
  }
  return [...needed];
}

export function frostSummaryFromParsedTmin(parsedByYear) {
  const results = [];
  for (const [year, rows] of Object.entries(parsedByYear)) {
    let lastFrost = null;
    for (const [mm, dd, tmin] of rows) {
      if (Number(mm) > 7) continue;
      if (tmin < 0) lastFrost = `${mm}-${dd}`;
    }
    if (lastFrost) results.push({ year: Number(year), lastFrost });
  }
  return results;
}

export function lastFrostMmDdPerYear(stationId, tminByStation) {
  const data = tminByStation[stationId];
  if (!data) return [];
  if (Array.isArray(data)) return data;

  return frostSummaryFromParsedTmin(data);
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

/** US stations with TMIN through at least minEndYear (inventory filter). */
export function parseGhcndInventory(text, minEndYear = 2020) {
  const tminEndYear = new Map();
  for (const line of text.split("\n")) {
    if (line.length < 30) continue;
    const id = line.slice(0, 11).trim();
    const element = line.slice(31, 36).trim();
    if (element !== "TMIN" || !id.startsWith("US")) continue;
    const endYear = Number(line.slice(41, 45).trim());
    const prev = tminEndYear.get(id) ?? 0;
    if (endYear > prev) tminEndYear.set(id, endYear);
  }
  return [...tminEndYear.entries()]
    .filter(([, end]) => end >= minEndYear)
    .map(([id]) => id);
}

export function filterStationsWithTminInventory(stations, inventoryIds) {
  const ids = new Set(inventoryIds);
  return stations.filter((s) => ids.has(s.id));
}

/** One station per lat/lon grid cell; prefer USW airport stations. */
export function selectRepresentativeStations(stations, cellDeg = 0.75) {
  const cells = new Map();
  for (const s of stations) {
    const key = `${Math.round(s.lat / cellDeg)}:${Math.round(s.lon / cellDeg)}`;
    const existing = cells.get(key);
    if (!existing) {
      cells.set(key, s);
      continue;
    }
    const prefer = s.id.startsWith("USW") && !existing.id.startsWith("USW");
    if (prefer) cells.set(key, s);
  }
  return [...cells.values()];
}

export async function fetchGhcndStations() {
  const res = await fetch(GHCND_STATIONS_URL);
  if (!res.ok) {
    throw new Error(`GHCN station download failed: ${res.status}`);
  }
  return parseGhcndStations(await res.text());
}

export async function fetchGhcndInventory() {
  const res = await fetch(GHCND_INVENTORY_URL);
  if (!res.ok) {
    throw new Error(`GHCN inventory download failed: ${res.status}`);
  }
  return await res.text();
}

export async function buildUsTminStationPool() {
  const [stations, inventoryText] = await Promise.all([
    fetchGhcndStations(),
    fetchGhcndInventory(),
  ]);
  const inventoryIds = parseGhcndInventory(inventoryText);
  const pool = filterStationsWithTminInventory(stations, inventoryIds);
  return { pool, inventoryIds: inventoryIds.length, stationCount: pool.length };
}

export const ZCTA_GAZETTEER_ZIP_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip";

export const ghcndDailyUrl = (stationId) =>
  `https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/${stationId}.dly`;

export function loadJson(root, relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

export function tryLoadJson(root, relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8"));
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

export function parsePhzmZipCsv(text) {
  const zones = {};
  const lines = text.trim().split("\n");
  for (let i = 1; i < lines.length; i++) {
    const [zip, zone] = lines[i].split(",");
    if (!zip || !zone) continue;
    zones[zip.padStart(5, "0")] = zone.trim().toLowerCase();
  }
  return zones;
}

export async function fetchPhzmZipZones() {
  const res = await fetch(PHZM_ZIP_CSV_URL);
  if (!res.ok) throw new Error(`PHZM CSV download failed: ${res.status}`);
  return parsePhzmZipCsv(await res.text());
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

export async function fetchStationFrostSummary(stationId, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ghcndDailyUrl(stationId));
      if (!res.ok) throw new Error(`status ${res.status}`);
      return frostSummaryFromParsedTmin(parseGhcndDailyTmin(await res.text()));
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error(`GHCN daily fetch failed for ${stationId}: ${lastErr?.message}`);
}

export async function fetchBundledStationTmin(stationIds, options = {}) {
  const { concurrency = 6, onProgress, onBatch, batchSize = 50, seed = {} } = options;
  const tminByStation = normalizeTminCache(seed);
  const queue = stationIds.filter((id) => !stationHasFrostTmin(id, tminByStation));
  let batchCount = 0;

  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      if (!id) break;
      try {
        tminByStation[id] = await fetchStationFrostSummary(id);
        onProgress?.(id, "ok");
      } catch (err) {
        onProgress?.(id, err.message);
      }
      batchCount++;
      if (onBatch && batchCount % batchSize === 0) {
        await onBatch(tminByStation, batchCount, queue.length);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()),
  );
  if (onBatch && batchCount % batchSize !== 0) {
    await onBatch(tminByStation, batchCount, queue.length);
  }
  return tminByStation;
}

export function mergeTminCaches(existing, fetched) {
  return { ...existing, ...fetched };
}

export function buildClimateManifest(output, skipped, stations, tminByStation, dataVersion) {
  const rows = Object.values(output);
  const distances = rows.map((r) => r.distanceKm).sort((a, b) => a - b);
  const withZone = rows.filter((r) => r.zone).length;
  const p = (q) =>
    distances[Math.min(distances.length - 1, Math.floor(q * (distances.length - 1)))] ?? 0;

  const tminStationCount = Object.keys(tminByStation).filter((id) =>
    stationHasFrostTmin(id, tminByStation),
  ).length;

  return {
    dataVersion,
    zipCount: rows.length,
    skippedCount: skipped.length,
    stationPoolCount: stations.length,
    tminStationCount,
    zoneFillRate: rows.length ? withZone / rows.length : 0,
    medianDistanceKm: p(0.5),
    p95DistanceKm: p(0.95),
    maxDistanceKm: distances[distances.length - 1] ?? 0,
    computedAt: new Date().toISOString(),
  };
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
    phzmZonesOverride = null,
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
  const phzmZones =
    phzmZonesOverride ??
    tryLoadJson(root, "data/zipZones-phzm.json") ??
    {};
  const spikeSample = loadJson(root, "data/spike/zipClimate-sample.json");

  const output = {};
  const skipped = [];

  const zipEntries = full
    ? Object.keys(centroids).map((zip) => [zip, zipZones[zip] ?? phzmZones[zip] ?? ""])
    : Object.entries(zipZones);

  for (const [zip, fixtureZone] of zipEntries) {
    const centroid = centroids[zip];
    if (!centroid) {
      skipped.push(zip);
      continue;
    }

    const { station, distanceKm } = nearestStationWithTmin(
      centroid,
      stations,
      tminByStation,
    );
    if (!station || distanceKm == null) {
      skipped.push(zip);
      continue;
    }

    const byYear = lastFrostMmDdPerYear(station.id, tminByStation);
    const percentiles = frostPercentiles(byYear);
    const zone = fixtureZone || phzmZones[zip] || undefined;

    output[zip] = {
      zip,
      zone,
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

  const manifest = buildClimateManifest(
    output,
    skipped,
    stations,
    tminByStation,
    dataVersion,
  );

  return {
    output,
    skipped,
    manifest,
    stationCount: stations.length,
    zipCount: Object.keys(output).length,
  };
}
