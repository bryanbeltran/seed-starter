#!/usr/bin/env node
/**
 * Discover and validate USDA PLANTS county nativity records.
 *
 *   pnpm run etl:natives-range-evidence           # fetch and preview
 *   pnpm run etl:natives-range-evidence -- --write # stage, validate, replace
 *
 * County FIPS come only from PLANTS Distribution Documentation. The County
 * MapServer Symbol supplies county nativity; regional profile status is used
 * only to detect direct contradictions, never to infer a county claim.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const plantsPath = path.join(root, "data/natives/plants.json");
const sourcesPath = path.join(root, "data/natives/native-sources.json");
const rangeEvidencePath = path.join(root, "data/natives/plant-range-evidence.json");
const write = process.argv.includes("--write");

export const PLANTS_API = "https://plantsservices.sc.egov.usda.gov/api";
export const COUNTY_LAYER_URL =
  "https://apps.geo.fpac.usda.gov/nrcs-geodata/rest/services/land_use_land_cover/plants/MapServer/6";

export const LOWER48 = [
  ["Alabama", "01"], ["Arizona", "04"], ["Arkansas", "05"],
  ["California", "06"], ["Colorado", "08"], ["Connecticut", "09"],
  ["Delaware", "10"], ["Florida", "12"], ["Georgia", "13"],
  ["Idaho", "16"], ["Illinois", "17"], ["Indiana", "18"],
  ["Iowa", "19"], ["Kansas", "20"], ["Kentucky", "21"],
  ["Louisiana", "22"], ["Maine", "23"], ["Maryland", "24"],
  ["Massachusetts", "25"], ["Michigan", "26"], ["Minnesota", "27"],
  ["Mississippi", "28"], ["Missouri", "29"], ["Montana", "30"],
  ["Nebraska", "31"], ["Nevada", "32"], ["New Hampshire", "33"],
  ["New Jersey", "34"], ["New Mexico", "35"], ["New York", "36"],
  ["North Carolina", "37"], ["North Dakota", "38"], ["Ohio", "39"],
  ["Oklahoma", "40"], ["Oregon", "41"], ["Pennsylvania", "42"],
  ["Rhode Island", "44"], ["South Carolina", "45"],
  ["South Dakota", "46"], ["Tennessee", "47"], ["Texas", "48"],
  ["Utah", "49"], ["Vermont", "50"], ["Virginia", "51"],
  ["Washington", "53"], ["West Virginia", "54"], ["Wisconsin", "55"],
  ["Wyoming", "56"],
].map(([name, fips]) => ({ name, fips }));

const KNOWN_NATIVITY_SYMBOLS = new Set([
  "Native",
  "Introduced",
  "Both",
  "Excluded",
  "Unknown",
]);
function value(object, pascalName, camelName) {
  return object?.[pascalName] ?? object?.[camelName];
}

function normalizeLocationName(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Interpret the published county Symbol text; the numeric nativity ID stays opaque. */
export function countyCodeFromSymbol(symbol) {
  const normalizedSymbol = String(symbol ?? "").trim();
  if (!KNOWN_NATIVITY_SYMBOLS.has(normalizedSymbol)) {
    throw new Error(`Unrecognized USDA PLANTS county Symbol: ${normalizedSymbol || "(empty)"}`);
  }

  if (normalizedSymbol === "Native") return "native";
  if (normalizedSymbol === "Introduced") return "not_native";
  return "unknown";
}

export function parseDistributionDocumentation(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const text = String(csv ?? "").replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);

  const headerIndex = rows.findIndex((candidate) => candidate[0]?.trim() === "Symbol");
  if (headerIndex < 0) throw new Error("PLANTS Distribution Documentation CSV header is missing");
  const headers = rows[headerIndex].map((cell) => cell.trim());
  const required = ["Symbol", "Country", "State", "State FIP", "County", "County FIP"];
  if (required.some((name) => !headers.includes(name))) {
    throw new Error("PLANTS Distribution Documentation CSV is missing required FIPS fields");
  }

  const index = Object.fromEntries(required.map((name) => [name, headers.indexOf(name)]));
  return rows.slice(headerIndex + 1).map((cells) =>
    Object.fromEntries(required.map((name) => [name, (cells[index[name]] ?? "").trim()])),
  );
}

export function indexDistributionFips(rows, lower48 = LOWER48) {
  const statesByName = new Map(lower48.map((state) => [normalizeLocationName(state.name), state]));
  const lower48StateFips = new Set(lower48.map((state) => state.fips));
  const byCountyName = new Map();
  for (const row of rows) {
    if (row.Country !== "United States" || !row["County FIP"]) continue;
    const state = statesByName.get(normalizeLocationName(row.State));
    const stateFips = String(row["State FIP"] ?? "").trim().padStart(2, "0");
    const countyFips = String(row["County FIP"] ?? "").trim().padStart(3, "0");
    if (
      !/^\d{2}$/.test(stateFips) ||
      !/^\d{3}$/.test(countyFips) ||
      !row.State?.trim() ||
      !row.County?.trim() ||
      (state && stateFips !== state.fips)
    ) {
      throw new Error(`Invalid USDA PLANTS FIPS for ${row.State}, ${row.County}`);
    }
    const fips = `${stateFips}${countyFips}`;
    const nameKey = normalizeLocationName(row.County);
    let matches = byCountyName.get(nameKey);
    if (!matches) {
      matches = new Map();
      byCountyName.set(nameKey, matches);
    }
    const location = { stateName: row.State, countyName: row.County, fips };
    const previous = matches.get(fips);
    if (previous && previous.stateName !== state.name) {
      throw new Error(`USDA Distribution Documentation has conflicting FIPS ${fips} for ${row.County}`);
    }
    matches.set(fips, location);
  }
  return new Map(
    [...byCountyName].map(([name, matches]) => {
      if (matches.size !== 1) return [name, null];
      const location = matches.values().next().value;
      if (lower48StateFips.has(location.fips.slice(0, 2))) return [name, location];
      return [name, { ...location, fips: null, knownOutsideLower48: true }];
    }),
  );
}

export function buildPlantRangeEvidence({
  plant,
  masterId,
  distributionCsv,
  countyFeatures,
  source,
  retrievedAt,
  lower48 = LOWER48,
}) {
  const distributionRows = parseDistributionDocumentation(distributionCsv);
  const distributionFipsByCountyName = indexDistributionFips(distributionRows, lower48);
  const records = [];
  const seenIds = new Set();

  for (const feature of countyFeatures) {
    const attributes = feature.attributes ?? feature;
    const featureMasterId = Number(value(attributes, "plant_master_id", "plantMasterId"));
    const subdivisionId = Number(value(attributes, "country_subdivision_id", "countrySubdivisionId"));
    const layerName = String(value(attributes, "country_subdivision_name", "countrySubdivisionName") ?? "").trim();
    if (featureMasterId !== Number(masterId)) {
      throw new Error(`USDA County layer returned a different plant master ID for ${plant.id}`);
    }
    if (!Number.isSafeInteger(subdivisionId) || subdivisionId <= 0 || !layerName) {
      throw new Error(`USDA County layer subdivision ${subdivisionId} has no county name`);
    }
    if (seenIds.has(subdivisionId)) {
      throw new Error(`USDA returned duplicate county layer row for ${plant.id}/${subdivisionId}`);
    }
    seenIds.add(subdivisionId);

    const mappedLocation = distributionFipsByCountyName.get(normalizeLocationName(layerName)) ?? null;
    if (mappedLocation?.knownOutsideLower48) continue;
    const location = {
      stateName: mappedLocation?.stateName ?? null,
      countyName: mappedLocation?.countyName ?? layerName,
    };

    const symbol = value(attributes, "Symbol", "symbol");
    const nativityId = value(attributes, "plant_nativity_id", "plantNativityId");
    const nativityStatus = countyCodeFromSymbol(symbol);
    let uncertainty =
      symbol === "Native" || symbol === "Introduced"
        ? `Nativity is read from the published county Symbol; plant_nativity_id ${JSON.stringify(nativityId ?? null)} is retained as metadata but its numeric code is not interpreted.`
        : `USDA PLANTS County layer Symbol is ${JSON.stringify(symbol)} (plant_nativity_id ${JSON.stringify(nativityId ?? null)}); this is preserved as unknown nativity.`;

    const countyFips = mappedLocation?.fips ?? null;
    if (!mappedLocation) {
      uncertainty = [
        uncertainty,
        `The USDA Distribution Documentation has no unique lower-48 county FIPS for county-layer name ${JSON.stringify(layerName)} (subdivision ${subdivisionId}); state and FIPS remain unknown, so this record cannot match a ZIP county.`,
      ].filter(Boolean).join(" ");
    }

    const fipsDescription = countyFips ?? "unknown FIPS";
    const locationCitation = location.stateName
      ? `${location.countyName}, ${location.stateName}; Distribution Documentation county FIPS ${fipsDescription}`
      : `County layer name ${JSON.stringify(location.countyName)}; state and Distribution Documentation county FIPS unresolved`;
    const citation =
      `USDA, NRCS. PLANTS Database. ${plant.scientificName}. County Symbol ${JSON.stringify(symbol)} ` +
      `(plant_nativity_id ${JSON.stringify(nativityId ?? null)}; plant_master_id ${masterId}; ` +
      `country_subdivision_id ${subdivisionId}; ${locationCitation}).`;

    records.push({
      plantId: plant.id,
      sourceId: "usda-plants",
      sourceCitation: citation,
      sourceUrl: COUNTY_LAYER_URL,
      releaseOrObservationDate: null,
      retrievedAt,
      licenseNote: source.licenseNote ?? null,
      geographicScope: mappedLocation
        ? `County or county-equivalent: ${location.countyName}, ${location.stateName}.`
        : `Unresolved USDA county-layer subdivision ${subdivisionId}: ${location.countyName}; state and county FIPS unknown.`,
      spatialResolution: "county",
      countyFips,
      nativityStatus,
      uncertainty,
    });
  }
  return records;
}

function parsePlantSymbol(sourceUrl) {
  const url = new URL(sourceUrl);
  if (url.hostname !== "plants.usda.gov") {
    throw new Error(`Native catalog URL is not a USDA PLANTS profile: ${sourceUrl}`);
  }
  const symbol = url.searchParams.get("symbol") ?? url.searchParams.get("SYMBOL");
  if (!symbol || !/^[A-Z0-9]+$/i.test(symbol)) {
    throw new Error(`Native catalog profile URL has no USDA symbol: ${sourceUrl}`);
  }
  return symbol.toUpperCase();
}

async function request(url, options, fetchImpl) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetchImpl(url, options);
      if (response.ok) return response;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 4) {
        throw new Error(`USDA request failed (${response.status}): ${url}`);
      }
      const retryAfter = Number(response.headers?.get?.("retry-after")) || 0;
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 300 * 2 ** attempt)));
    } catch (error) {
      lastError = error;
      if (attempt === 4 || String(error?.message).includes("USDA request failed (")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    }
  }
  throw lastError ?? new Error(`USDA request failed: ${url}`);
}

async function getJson(url, fetchImpl) {
  const response = await request(url, { headers: { accept: "application/json" } }, fetchImpl);
  return response.json();
}

async function getText(url, fetchImpl) {
  const response = await request(url, { headers: { accept: "text/csv,text/plain" } }, fetchImpl);
  return response.text();
}

async function postJsonText(url, body, fetchImpl) {
  const response = await request(
    url,
    {
      method: "POST",
      headers: { accept: "text/csv,text/plain", "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    fetchImpl,
  );
  return response.text();
}

async function fetchCountyFeatures(masterId, fetchImpl) {
  const allFeatures = [];
  const pageSize = 1000;
  for (let resultOffset = 0; resultOffset < 100_000; resultOffset += pageSize) {
    const url = new URL(`${COUNTY_LAYER_URL}/query`);
    url.searchParams.set("where", `plant_master_id=${masterId}`);
    url.searchParams.set(
      "outFields",
      "plant_master_id,plant_nativity_id,country_subdivision_id,country_subdivision_name,Symbol",
    );
    url.searchParams.set("returnGeometry", "false");
    url.searchParams.set("resultOffset", String(resultOffset));
    url.searchParams.set("resultRecordCount", String(pageSize));
    url.searchParams.set("orderByFields", "country_subdivision_id");
    url.searchParams.set("f", "json");
    const response = await getJson(url, fetchImpl);
    if (response.error) {
      throw new Error(`USDA County layer query failed: ${JSON.stringify(response.error)}`);
    }
    const features = response.features;
    if (!Array.isArray(features)) throw new Error("USDA County layer response omitted features");
    allFeatures.push(...features);
    if (!response.exceededTransferLimit && features.length < pageSize) return allFeatures;
    if (features.length === 0) return allFeatures;
  }
  throw new Error(`USDA County layer exceeded pagination limit for plant ${masterId}`);
}

function assertPlantSearch(symbol, searchResults, profile) {
  if (!Array.isArray(searchResults)) throw new Error(`PLANTS PlantSearch failed to resolve ${symbol}`);
  const exact = searchResults.filter(
    (result) => value(value(result, "Plant", "plant"), "Symbol", "symbol") === symbol,
  );
  if (exact.length !== 1) {
    throw new Error(`PLANTS PlantSearch returned ${exact.length} exact taxa for ${symbol}`);
  }
  const searchPlant = value(exact[0], "Plant", "plant");
  const profileId = Number(value(profile, "Id", "id"));
  const searchId = Number(value(searchPlant, "Id", "id"));
  if (
    value(profile, "Symbol", "symbol") !== symbol ||
    !Number.isSafeInteger(profileId) ||
    profileId !== searchId
  ) {
    throw new Error(`PLANTS profile does not match PlantSearch taxon ${symbol}`);
  }
  return profileId;
}

export function validateRangeEvidenceFile(payload, { plantIds, sources }) {
  if (!payload || typeof payload.version !== "string" || typeof payload.provenance !== "string") {
    throw new Error("Native range-evidence file is missing version or provenance");
  }
  if (!Array.isArray(payload.records)) throw new Error("Native range-evidence records are missing");
  if (payload.records.length === 0) {
    throw new Error("Native range-evidence response has no records; refusing to replace last-good data");
  }
  const expectedPlantIds = new Set(plantIds);
  const seen = new Set();
  for (const [index, record] of payload.records.entries()) {
    const path = `records[${index}]`;
    if (!expectedPlantIds.has(record.plantId)) throw new Error(`${path}: unknown plantId ${record.plantId}`);
    const source = sources[record.sourceId];
    if (!source) throw new Error(`${path}: unknown sourceId ${record.sourceId}`);
    if (source.authority !== "USDA PLANTS" || !source.rangeEvidenceAvailable) {
      throw new Error(`${path}: source is not an approved USDA range-evidence source`);
    }
    if (!record.sourceCitation?.trim()) throw new Error(`${path}: sourceCitation is required`);
    let url;
    try {
      url = new URL(record.sourceUrl);
    } catch {
      throw new Error(`${path}: sourceUrl is invalid`);
    }
    if (
      url.protocol !== "https:" ||
      !(url.hostname === "usda.gov" || url.hostname.endsWith(".usda.gov"))
    ) {
      throw new Error(`${path}: sourceUrl is not an official USDA HTTPS URL`);
    }
    if (
      record.releaseOrObservationDate !== null &&
      (typeof record.releaseOrObservationDate !== "string" ||
        Number.isNaN(Date.parse(record.releaseOrObservationDate)))
    ) {
      throw new Error(`${path}: releaseOrObservationDate must be a valid date or null`);
    }
    if (!record.retrievedAt || Number.isNaN(Date.parse(record.retrievedAt))) {
      throw new Error(`${path}: retrievedAt must be a valid timestamp`);
    }
    for (const key of ["licenseNote", "geographicScope", "uncertainty"]) {
      if (record[key] !== null && typeof record[key] !== "string") {
        throw new Error(`${path}: ${key} must be a string or null`);
      }
    }
    if (!["county", "finer", "state", "unknown"].includes(record.spatialResolution)) {
      throw new Error(`${path}: spatialResolution is invalid`);
    }
    if (record.countyFips !== null && !/^\d{5}$/.test(record.countyFips)) {
      throw new Error(`${path}: countyFips must be five digits or null`);
    }
    if (!["native", "not_native", "unknown"].includes(record.nativityStatus)) {
      throw new Error(`${path}: nativityStatus is invalid`);
    }
    if (!record.sourceCitation.toUpperCase().includes("USDA")) {
      throw new Error(`${path}: sourceCitation must identify USDA`);
    }
    const key = [record.plantId, record.countyFips ?? "?", record.sourceCitation].join("|");
    if (seen.has(key)) throw new Error(`${path}: duplicate range-evidence record`);
    seen.add(key);
  }
  return payload;
}

export function commitRangeEvidenceAtomically(outputPath, payload, validation) {
  validateRangeEvidenceFile(payload, validation);
  const stagedPath = `${outputPath}.staged`;
  try {
    fs.writeFileSync(stagedPath, `${JSON.stringify(payload)}\n`);
    const stagedPayload = JSON.parse(fs.readFileSync(stagedPath, "utf8"));
    validateRangeEvidenceFile(stagedPayload, validation);
    fs.renameSync(stagedPath, outputPath);
  } catch (error) {
    fs.rmSync(stagedPath, { force: true });
    throw error;
  }
}

function recordIdentity(record) {
  return [record.plantId, record.countyFips ?? "?", record.geographicScope].join("|");
}

export function discoverRangeEvidenceChanges(previous, next) {
  const previousById = new Map((previous?.records ?? []).map((record) => [recordIdentity(record), record]));
  const nextById = new Map(next.records.map((record) => [recordIdentity(record), record]));
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const [id, record] of nextById) {
    const prior = previousById.get(id);
    if (!prior) {
      added++;
      continue;
    }
    const priorComparable = { ...prior, retrievedAt: null };
    const nextComparable = { ...record, retrievedAt: null };
    if (JSON.stringify(priorComparable) !== JSON.stringify(nextComparable)) changed++;
  }
  for (const id of previousById.keys()) if (!nextById.has(id)) removed++;
  return { added, removed, changed, current: nextById.size };
}

export async function fetchRangeEvidence({
  plants,
  sources,
  fetchImpl = fetch,
  now = new Date(),
  onPlant = () => {},
}) {
  const source = sources["usda-plants"];
  if (!source?.licenseNote?.trim()) {
    throw new Error("Approved USDA PLANTS reuse note is missing");
  }
  const retrievedAt = now.toISOString();
  const records = [];
  for (const plant of Object.values(plants)) {
    const symbol = parsePlantSymbol(plant.sourceUrl);
    const searchUrl = new URL(`${PLANTS_API}/PlantSearch`);
    searchUrl.searchParams.set("searchText", symbol);
    const searchResults = await getJson(searchUrl, fetchImpl);
    const profileUrl = new URL(`${PLANTS_API}/PlantProfile`);
    profileUrl.searchParams.set("symbol", symbol);
    const profile = await getJson(profileUrl, fetchImpl);
    const masterId = assertPlantSearch(symbol, searchResults, profile);
    const distributionCsv = await postJsonText(
      `${PLANTS_API}/PlantProfile/getDownloadDistributionDocumentation`,
      { masterId },
      fetchImpl,
    );
    const countyFeatures = await fetchCountyFeatures(masterId, fetchImpl);
    const plantRecords = buildPlantRangeEvidence({
      plant,
      masterId,
      profile,
      distributionCsv,
      countyFeatures,
      source,
      retrievedAt,
    });
    records.push(...plantRecords);
    onPlant({ id: plant.id, symbol, recordCount: plantRecords.length });
  }

  const payload = {
    version: `usda-plants-live-${retrievedAt.slice(0, 10)}`,
    provenance:
      `Retrieved ${retrievedAt} from USDA PLANTS PlantSearch, PlantProfile, Distribution Documentation, and the official NRCS PLANTS Counties MapServer layer. Only the county Symbol text is used for nativity; profile region status and numeric plant_nativity_id are not interpreted as local status. No per-record release or observation date has been verified, so it is null and retrieval time is recorded. County FIPS are joined only when the layer county name resolves to one unique U.S. state/county row, and that row is in the lower 48, in the same plant's official Distribution Documentation. Uniquely identified non-lower-48 rows are excluded; ambiguous or missing name matches remain null and cannot match ZIPs. This name crosswalk does not independently resolve the MapServer subdivision ID.`,
    records,
  };
  validateRangeEvidenceFile(payload, {
    plantIds: Object.keys(plants),
    sources,
  });
  return payload;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export async function main() {
  const plants = readJson(plantsPath).plants;
  const sourcesFile = readJson(sourcesPath);
  const current = readJson(rangeEvidencePath);
  const next = await fetchRangeEvidence({
    plants,
    sources: sourcesFile.sources,
    onPlant: ({ id, symbol, recordCount }) =>
      console.log(`${symbol} (${id}): ${recordCount} county records`),
  });
  const changes = discoverRangeEvidenceChanges(current, next);
  console.log(`records=${next.records.length} discovery=${JSON.stringify(changes)}`);
  if (!write) {
    console.log("dry-run (pass --write to stage, validate, and replace the last-good file)");
    return;
  }
  commitRangeEvidenceAtomically(rangeEvidencePath, next, {
    plantIds: Object.keys(plants),
    sources: sourcesFile.sources,
  });
  console.log(`wrote ${rangeEvidencePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
