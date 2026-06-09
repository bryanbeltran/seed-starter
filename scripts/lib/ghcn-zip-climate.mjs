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

export function loadJson(root, relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
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
  } = options;

  const stations = stationsOverride ?? loadJson(root, stationsPath);
  const tminByStation = loadJson(root, tminPath);
  const centroids = loadJson(root, centroidsPath);
  const zipZones = loadJson(root, zonesPath);

  const output = {};
  const skipped = [];

  for (const [zip, zone] of Object.entries(zipZones)) {
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

  return { output, skipped, stationCount: stations.length };
}
