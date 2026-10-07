#!/usr/bin/env node
/**
 * Discover and validate source-reviewed lower-48 county nativity records.
 *
 *   pnpm run etl:natives-range-evidence           # fetch and preview
 *   pnpm run etl:natives-range-evidence -- --write # stage, validate, replace
 *
 * USDA county FIPS come from PLANTS Distribution Documentation and the County
 * MapServer Symbol supplies USDA county status. BONAP can affirm only through
 * a current-hash, exact-taxon, manually reviewed NAPA county-map conversion.
 * TDC and NPIN remain identity, presence, or enrichment data only.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { summarizeNativeSourceEvidence } from "./lib/native-source-evidence.mjs";
import {
  isEligibleFinerRangeEvidenceRecord,
  isEligibleRangeEvidenceClaim,
} from "./lib/native-claim-eligibility.mjs";
import {
  BONAP_FULL_TAXON_LIST_VERIFIED_BYTES,
  BONAP_URLS,
  assertValidBonapCountyMapPng,
  buildBonapCountyEvidence,
  fetchBonapMapSnapshots,
  fetchBonapSourceSnapshot,
} from "./lib/bonap-native-source.mjs";
import { fetchNpinEnrichment } from "./lib/npin-source.mjs";
import { normalizeScientificName } from "./lib/native-taxonomy.mjs";
import {
  createNativeRefreshStatus,
  failNativeRefreshStatus,
  persistNativeRefreshStatus,
} from "./lib/native-refresh-status.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const plantsPath = path.join(root, "data/natives/plants.json");
const sourcesPath = path.join(root, "data/natives/native-sources.json");
const rangeEvidencePath = path.join(root, "data/natives/plant-range-evidence.json");
const countyDataPath = path.join(root, "data/natives/zip-county.json");
const bonapReviewsPath = path.join(root, "data/natives/bonap-county-map-reviews.json");
const sourceIngestionPath = path.join(root, "data/natives/native-source-ingestion.json");
const bonapMapAssetsPath = path.join(root, "data/natives/bonap-map-snapshots");
const write = process.argv.includes("--write");

export const PLANTS_API = "https://plantsservices.sc.egov.usda.gov/api";
export const COUNTY_BOUNDARIES_URL =
  "https://apps.geo.fpac.usda.gov/nrcs-geodata/rest/services/land_use_land_cover/plants/MapServer/2";
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

function geometryBounds(geometry) {
  const rings = geometry?.rings;
  if (!Array.isArray(rings)) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const point of ring ?? []) {
      const [x, y] = point;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)
    ? { minX, minY, maxX, maxY }
    : null;
}

function sameGeometryBounds(left, right) {
  const a = geometryBounds(left);
  const b = geometryBounds(right);
  if (!a || !b) return false;
  return ["minX", "minY", "maxX", "maxY"].every((key) => Math.abs(a[key] - b[key]) < 1e-8);
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

function indexDistributionFipsByCode(rows, lower48 = LOWER48) {
  const lower48StateFips = new Set(lower48.map((state) => state.fips));
  const byFips = new Map();
  for (const row of rows) {
    if (row.Country !== "United States" || !row["County FIP"]) continue;
    const stateFips = String(row["State FIP"] ?? "").trim().padStart(2, "0");
    const countyFips = String(row["County FIP"] ?? "").trim().padStart(3, "0");
    if (!/^\d{2}$/.test(stateFips) || !/^\d{3}$/.test(countyFips)) continue;
    if (!lower48StateFips.has(stateFips)) continue;
    const fips = `${stateFips}${countyFips}`;
    const location = {
      stateName: row.State,
      countyName: row.County,
      fips,
    };
    const previous = byFips.get(fips);
    if (previous && (previous.stateName !== location.stateName || previous.countyName !== location.countyName)) {
      throw new Error(`USDA Distribution Documentation has conflicting FIPS ${fips}`);
    }
    byFips.set(fips, location);
  }
  return byFips;
}

/**
 * Resolve the USDA county-layer subdivision IDs to official county FIPS.
 * The plant-specific layer only exposes a county name and an opaque ID; the
 * sibling county-boundary layer is the authoritative ID→FIPS crosswalk.
 */
export async function fetchCountyFipsIndex({
  fetchImpl = fetch,
  lower48 = LOWER48,
} = {}) {
  const lower48StateFips = new Set(lower48.map((state) => state.fips));
  const stateByFips = new Map(lower48.map((state) => [state.fips, state.name]));
  const byName = new Map();
  const pageSize = 2_000;
  for (let resultOffset = 0; resultOffset < 100_000; resultOffset += pageSize) {
    const url = new URL(`${COUNTY_BOUNDARIES_URL}/query`);
    url.searchParams.set("where", "1=1");
    url.searchParams.set(
      "outFields",
      "plant_location_id,country_subdivision_code,country_subdivision_name",
    );
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("resultOffset", String(resultOffset));
    url.searchParams.set("resultRecordCount", String(pageSize));
    url.searchParams.set("orderByFields", "plant_location_id");
    url.searchParams.set("f", "json");
    const response = await getJson(url, fetchImpl);
    if (response.error) {
      throw new Error(`USDA county-boundary query failed: ${JSON.stringify(response.error)}`);
    }
    const features = response.features;
    if (!Array.isArray(features)) throw new Error("USDA county-boundary response omitted features");
    for (const feature of features) {
      const attributes = feature.attributes ?? feature;
      const subdivisionId = Number(value(attributes, "plant_location_id", "plantLocationId"));
      const fips = String(value(attributes, "country_subdivision_code", "countrySubdivisionCode") ?? "").trim();
      const countyName = String(value(attributes, "country_subdivision_name", "countrySubdivisionName") ?? "").trim();
      if (!Number.isSafeInteger(subdivisionId) || subdivisionId <= 0 || !countyName) {
        throw new Error("USDA county-boundary response contains an invalid subdivision row");
      }
      if (!/^\d{5}$/.test(fips)) {
        throw new Error(`USDA county-boundary response contains invalid FIPS ${JSON.stringify(fips)}`);
      }
      const location = {
        stateName: stateByFips.get(fips.slice(0, 2)) ?? null,
        countyName,
        fips,
        knownOutsideLower48: !lower48StateFips.has(fips.slice(0, 2)),
        geometry: feature.geometry ?? null,
      };
      const nameKey = normalizeLocationName(countyName);
      const candidates = byName.get(nameKey) ?? [];
      if (!candidates.some((candidate) => candidate.fips === location.fips)) {
        candidates.push(location);
        byName.set(nameKey, candidates);
      }
    }
    if (!response.exceededTransferLimit && features.length < pageSize) return { byName };
    if (features.length === 0) return { byName };
  }
  throw new Error("USDA county-boundary layer exceeded pagination limit");
}

function boundaryLocationForFeature(feature, layerName, countyBoundaryIndex) {
  const candidates = countyBoundaryIndex?.byName?.get(normalizeLocationName(layerName)) ?? [];
  if (candidates.length === 1) return candidates[0];
  if (!feature.geometry) return null;
  const matches = candidates.filter((candidate) => sameGeometryBounds(feature.geometry, candidate.geometry));
  return matches.length === 1 ? matches[0] : null;
}

export function buildPlantRangeEvidence({
  plant,
  masterId,
  distributionCsv,
  countyFeatures,
  source,
  retrievedAt,
  lower48 = LOWER48,
  countyFipsBySubdivisionId = null,
  countyBoundaryIndex = null,
}) {
  const distributionRows = parseDistributionDocumentation(distributionCsv);
  const distributionFipsByCountyName = indexDistributionFips(distributionRows, lower48);
  const distributionFipsByCode = indexDistributionFipsByCode(distributionRows, lower48);
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

    const layerLocation = countyFipsBySubdivisionId?.get(subdivisionId) ??
      boundaryLocationForFeature(feature, layerName, countyBoundaryIndex);
    if (layerLocation?.knownOutsideLower48) continue;
    const mappedLocation = countyFipsBySubdivisionId || countyBoundaryIndex
      ? layerLocation?.fips && distributionFipsByCode.has(layerLocation.fips)
        ? distributionFipsByCode.get(layerLocation.fips)
        : null
      : distributionFipsByCountyName.get(normalizeLocationName(layerName)) ?? null;
    if (mappedLocation?.knownOutsideLower48) continue;
    const location = {
      stateName: mappedLocation?.stateName ?? layerLocation?.stateName ?? null,
      countyName: mappedLocation?.countyName ?? layerLocation?.countyName ?? layerName,
    };

    const symbol = value(attributes, "Symbol", "symbol");
    const nativityId = value(attributes, "plant_nativity_id", "plantNativityId");
    const nativityStatus = countyCodeFromSymbol(symbol);
    let uncertainty =
      symbol === "Native" || symbol === "Introduced"
        ? `Nativity is read from the published county Symbol; plant_nativity_id ${JSON.stringify(nativityId ?? null)} is retained as metadata but its numeric code is not interpreted.`
        : `USDA PLANTS County layer Symbol is ${JSON.stringify(symbol)} (plant_nativity_id ${JSON.stringify(nativityId ?? null)}); this is preserved as unknown nativity.`;

    const countyFips = mappedLocation?.fips ?? null;
    const resolvedNativityStatus = countyFips ? nativityStatus : "unknown";
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
      nativityStatus: resolvedNativityStatus,
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

async function fetchCountyFeatures(masterId, fetchImpl, { returnGeometry = false } = {}) {
  const allFeatures = [];
  const pageSize = 1000;
  for (let resultOffset = 0; resultOffset < 100_000; resultOffset += pageSize) {
    const url = new URL(`${COUNTY_LAYER_URL}/query`);
    url.searchParams.set("where", `plant_master_id=${masterId}`);
    url.searchParams.set(
      "outFields",
      "plant_master_id,plant_nativity_id,country_subdivision_id,country_subdivision_name,Symbol",
    );
    url.searchParams.set("returnGeometry", String(returnGeometry));
    if (returnGeometry) url.searchParams.set("outSR", "4326");
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

export function validateRangeEvidenceFile(payload, {
  plantIds,
  sources,
  bonapMapSnapshots = [],
  bonapReviewRecords = [],
}) {
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
    if (!source.rangeEvidenceAvailable) {
      throw new Error(`${path}: source is not enabled for range-evidence records`);
    }
    if (!record.sourceCitation?.trim()) throw new Error(`${path}: sourceCitation is required`);
    let url;
    try {
      url = new URL(record.sourceUrl);
    } catch {
      throw new Error(`${path}: sourceUrl is invalid`);
    }
    if (record.spatialResolution === "finer") {
      if (!isEligibleFinerRangeEvidenceRecord(record, sources)) {
        throw new Error(`${path}: finer evidence is not tied to a verified ZCTA-capable source`);
      }
    } else if (record.sourceId === "usda-plants") {
      if (
        source.authority !== "USDA PLANTS" ||
        url.protocol !== "https:" ||
        !(url.hostname === "usda.gov" || url.hostname.endsWith(".usda.gov")) ||
        !record.sourceCitation.toUpperCase().includes("USDA")
      ) {
        throw new Error(`${path}: sourceUrl is not an official USDA HTTPS URL`);
      }
    } else if (record.sourceId === "bonap-napa") {
      if (
        source.authority !== "Biota of North America Program (BONAP)" ||
        source.sourceTermsStatus !== "verified" ||
        !source.ownerAuthorizationNote?.trim() ||
        url.protocol !== "https:" ||
        url.hostname !== "bonap.net" ||
        !/^\/MapGallery\/County\/[^/]+\.png$/i.test(url.pathname) ||
        !record.sourceCitation.toUpperCase().includes("BONAP")
      ) {
        throw new Error(`${path}: BONAP record is not linked to an authorized official county map`);
      }
      const review = record.bonapReview;
      if (
        !review ||
        !/^[a-f0-9]{64}$/.test(review.mapSha256 ?? "") ||
        review.mapKeyUrl !== BONAP_URLS.mapKey ||
        typeof review.rawCategory !== "string" ||
        !(review.mapGenerationDateSource === null || ["png_content_metadata", "visual_map_content"].includes(review.mapGenerationDateSource)) ||
        !["exact", "ambiguous", "unresolved"].includes(review.taxonomyMatch) ||
        !["confirmed_taxon_scope", "may_conflate_infraspecific", "unresolved"].includes(review.mapScopeDecision) ||
        !["approved", "pending", "rejected"].includes(review.reviewStatus) ||
        typeof review.currentStatusConfirmed !== "boolean" ||
        !review.reviewer?.trim() ||
        !review.reviewedAt ||
        Number.isNaN(Date.parse(review.reviewedAt)) ||
        !review.reviewNote?.trim() ||
        (review.mapGenerationDate !== null && Number.isNaN(Date.parse(review.mapGenerationDate))) ||
        (review.mapGenerationDate === null ? review.mapGenerationDateSource !== null : !review.mapGenerationDateSource)
      ) {
        throw new Error(`${path}: BONAP county record is missing reviewable map provenance`);
      }
      if (!isEligibleRangeEvidenceClaim(record, sources, bonapMapSnapshots, null, bonapReviewRecords)) {
        throw new Error(`${path}: BONAP claim does not match its approved map review conversion`);
      }
      const mapScopeConfirmed = review.mapScopeDecision === "confirmed_taxon_scope";
      if (mapScopeConfirmed && review.rawCategory === "Native" && record.nativityStatus !== "native") {
        throw new Error(`${path}: BONAP Native category with confirmed taxon scope must remain native`);
      }
      if (mapScopeConfirmed && ["Native Historic", "Adventive", "Exotic"].includes(review.rawCategory) && record.nativityStatus !== "not_native") {
        throw new Error(`${path}: BONAP ${review.rawCategory} category with confirmed taxon scope must remain non-affirmative`);
      }
      if ((!mapScopeConfirmed || !new Set(["Native", "Native Historic", "Adventive", "Exotic"]).has(review.rawCategory)) && record.nativityStatus !== "unknown") {
        throw new Error(`${path}: unresolved BONAP map scope or category must remain unknown`);
      }
    } else {
      throw new Error(`${path}: source has no county range-evidence adapter`);
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
    if (record.spatialResolution !== "finer" && record.finerArea !== undefined) {
      throw new Error(`${path}: finerArea is only valid for finer evidence`);
    }
    if (record.countyFips !== null && !/^\d{5}$/.test(record.countyFips)) {
      throw new Error(`${path}: countyFips must be five digits or null`);
    }
    if (!["native", "not_native", "unknown"].includes(record.nativityStatus)) {
      throw new Error(`${path}: nativityStatus is invalid`);
    }
    if (record.nativityStatus !== "unknown" &&
      (record.spatialResolution === "county" || record.spatialResolution === "finer")) {
      const eligible = record.spatialResolution === "finer"
        ? isEligibleFinerRangeEvidenceRecord(record, sources)
        : record.countyFips !== null && isEligibleRangeEvidenceClaim(
            record,
            sources,
            bonapMapSnapshots,
            null,
            bonapReviewRecords,
          );
      if (!eligible) throw new Error(`${path}: source-specific evidence does not meet the native claim gate`);
    }
    const area = record.finerArea
      ? `${record.finerArea.geography}:${record.finerArea.zctaId}`
      : record.countyFips ?? "?";
    const key = [record.plantId, area, record.sourceCitation].join("|");
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

export function commitNativeEvidenceSnapshotAtomically({
  rangeEvidencePath: outputRangePath,
  rangeEvidence,
  rangeValidation,
  sourceIngestionPath: outputIngestionPath,
  sourceIngestion,
  sourceValidation,
  mapAssets = [],
}) {
  validateRangeEvidenceFile(rangeEvidence, rangeValidation);
  validateSourceIngestionSnapshot(sourceIngestion, sourceValidation);
  for (const asset of mapAssets) {
    const digest = asset.path.match(/([a-f0-9]{64})\.png$/)?.[1];
    if (!digest || createHash("sha256").update(asset.bytes).digest("hex") !== digest) {
      throw new Error(`BONAP map snapshot asset does not match its content hash: ${asset.path}`);
    }
    assertValidBonapCountyMapPng(asset.bytes);
    if (fs.existsSync(asset.path)) {
      const existingHash = createHash("sha256").update(fs.readFileSync(asset.path)).digest("hex");
      if (existingHash !== digest) throw new Error(`Existing BONAP map asset has wrong hash: ${asset.path}`);
    }
  }
  const staged = [outputRangePath, outputIngestionPath].map((outputPath) => `${outputPath}.staged`);
  const previous = new Map(
    [outputRangePath, outputIngestionPath].map((outputPath) => [
      outputPath,
      fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null,
    ]),
  );
  try {
    for (const asset of mapAssets) {
      fs.mkdirSync(path.dirname(asset.path), { recursive: true });
      if (fs.existsSync(asset.path)) {
        continue;
      } else {
        const stagedAsset = `${asset.path}.staged`;
        fs.writeFileSync(stagedAsset, asset.bytes, { flag: "wx" });
        fs.renameSync(stagedAsset, asset.path);
      }
    }
    fs.writeFileSync(staged[0], `${JSON.stringify(rangeEvidence)}\n`);
    fs.writeFileSync(staged[1], `${JSON.stringify(sourceIngestion, null, 2)}\n`);
    validateRangeEvidenceFile(JSON.parse(fs.readFileSync(staged[0], "utf8")), rangeValidation);
    validateSourceIngestionSnapshot(
      JSON.parse(fs.readFileSync(staged[1], "utf8")),
      sourceValidation,
    );
    fs.renameSync(staged[0], outputRangePath);
    fs.renameSync(staged[1], outputIngestionPath);
  } catch (error) {
    for (let index = 0; index < staged.length; index++) {
      fs.rmSync(staged[index], { force: true });
    }
    for (const [outputPath, contents] of previous) {
      if (contents === null) {
        fs.rmSync(outputPath, { force: true });
        continue;
      }
      const restorePath = `${outputPath}.restore`;
      fs.writeFileSync(restorePath, contents);
      fs.renameSync(restorePath, outputPath);
    }
    throw error;
  }
}

function recordIdentity(record) {
  const area = record.finerArea
    ? `${record.finerArea.geography}:${record.finerArea.zctaId}`
    : record.countyFips ?? "?";
  return [record.sourceId, record.plantId, area, record.geographicScope].join("|");
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
  countyFipsBySubdivisionId = null,
  countyBoundaryIndex = null,
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
    const countyFeatures = await fetchCountyFeatures(masterId, fetchImpl, {
      returnGeometry: Boolean(countyBoundaryIndex),
    });
    const plantRecords = buildPlantRangeEvidence({
      plant,
      masterId,
      profile,
      distributionCsv,
      countyFeatures,
      source,
      retrievedAt,
      countyFipsBySubdivisionId,
      countyBoundaryIndex,
    });
    records.push(...plantRecords);
    onPlant({ id: plant.id, symbol, recordCount: plantRecords.length });
  }

  const payload = {
    version: `usda-plants-live-${retrievedAt.slice(0, 10)}`,
    provenance:
      `Retrieved ${retrievedAt} from USDA PLANTS PlantSearch, PlantProfile, Distribution Documentation, the official NRCS PLANTS Counties MapServer layer, and its County Boundaries geometry crosswalk. Only the county Symbol text is used for nativity; profile region status and numeric plant_nativity_id are not interpreted as local status. No per-record release or observation date has been verified, so it is null and retrieval time is recorded. County FIPS are joined by exact official county geometry and must also occur in the same plant's official Distribution Documentation. Uniquely identified non-lower-48 rows are excluded; unresolved joins remain unknown and cannot match ZIPs.`,
    records,
  };
  validateRangeEvidenceFile(payload, {
    plantIds: Object.keys(plants),
    sources,
  });
  return payload;
}

export function lower48CountyFipses(countyData) {
  const rows = Object.values(countyData.intersections ?? {}).flat();
  const fipses = rows.map((row) => row.fips);
  return [...new Set(fipses.filter((fips) =>
    /^\d{5}$/.test(String(fips ?? "")) &&
    LOWER48.some((state) => state.fips === String(fips).slice(0, 2)),
  ))].sort();
}

export function validateSourceIngestionSnapshot(payload, {
  countyFipses,
  plantIds,
  verifiedFullTaxonListBytes = BONAP_FULL_TAXON_LIST_VERIFIED_BYTES,
}) {
  if (!payload || payload.version !== "1" || !payload.retrievedAt || Number.isNaN(Date.parse(payload.retrievedAt))) {
    throw new Error("Native source-ingestion snapshot is missing version or retrieval time");
  }
  const bonap = payload.bonap;
  if (!bonap || bonap.sourceId !== "bonap-napa") throw new Error("BONAP source-ingestion snapshot is missing");
  if (
    !Number.isSafeInteger(bonap.fullTaxonList?.taxonCount) ||
    bonap.fullTaxonList.taxonCount <= 0 ||
    !Array.isArray(bonap.fullTaxonList.taxa) ||
    bonap.fullTaxonList.taxa.length !== bonap.fullTaxonList.taxonCount ||
    bonap.fullTaxonList.url !== "https://bonap.net/TDC/Query/FullTaxonList" ||
    bonap.fullTaxonList.completenessCheck !== "verified_response_bytes_and_strict_tsv_v1" ||
    bonap.fullTaxonList.verifiedResponseBytes !== verifiedFullTaxonListBytes ||
    !Number.isSafeInteger(bonap.fullTaxonList.responseBytes) ||
    bonap.fullTaxonList.responseBytes !== verifiedFullTaxonListBytes ||
    !/^[a-f0-9]{64}$/.test(bonap.fullTaxonList.sha256 ?? "") ||
    (bonap.fullTaxonList.etag != null && typeof bonap.fullTaxonList.etag !== "string") ||
    (bonap.fullTaxonList.lastModified != null && typeof bonap.fullTaxonList.lastModified !== "string") ||
    (bonap.fullTaxonList.contentLength != null &&
      (!Number.isSafeInteger(bonap.fullTaxonList.contentLength) ||
        bonap.fullTaxonList.contentLength !== bonap.fullTaxonList.responseBytes))
  ) {
    throw new Error("BONAP FullTaxonList snapshot is incomplete or has invalid taxa, count, or update markers");
  }
  for (const [index, taxon] of bonap.fullTaxonList.taxa.entries()) {
    if (
      !taxon ||
      !String(taxon.family ?? "").trim() ||
      !/^(?:×)?[A-Z][a-z-]+$/u.test(taxon.genus ?? "") ||
      !String(taxon.scientificName ?? "").trim()
    ) {
      throw new Error(`BONAP FullTaxonList snapshot contains malformed taxon row ${index}`);
    }
  }
  const expectedCounties = new Set(countyFipses);
  const actualCounties = new Set();
  const expectedDetailIds = new Set();
  for (const row of bonap.countyOccurrences ?? []) {
    if (!expectedCounties.has(row.countyFips) || actualCounties.has(row.countyFips)) {
      throw new Error(`BONAP county occurrence coverage has an unexpected or duplicate FIPS ${row.countyFips}`);
    }
    if (!Number.isSafeInteger(row.occurrenceTaxonCount) || row.occurrenceTaxonCount < 0) {
      throw new Error(`BONAP county occurrence count is invalid for ${row.countyFips}`);
    }
    if (
      !Number.isSafeInteger(row.pageCount) || row.pageCount < 1 ||
      !Array.isArray(row.pageUpdateMarkers) || row.pageUpdateMarkers.length !== row.pageCount ||
      !Number.isSafeInteger(row.speciesAndNothospeciesTaxonCount) ||
      row.speciesAndNothospeciesTaxonCount < 0 ||
      !Number.isSafeInteger(row.infraspecificTaxonCount) ||
      row.infraspecificTaxonCount < 0 ||
      !Number.isSafeInteger(row.reportedSpeciesAndNothospeciesCount) ||
      row.reportedSpeciesAndNothospeciesCount < 0 ||
      row.speciesAndNothospeciesTaxonCount !== row.reportedSpeciesAndNothospeciesCount ||
      row.occurrenceTaxonCount !== row.speciesAndNothospeciesTaxonCount + row.infraspecificTaxonCount
    ) {
      throw new Error(`BONAP county occurrence pages or source count are invalid for ${row.countyFips}`);
    }
    for (const marker of row.pageUpdateMarkers) {
      if (
        typeof marker.page !== "string" ||
        (marker.etag != null && typeof marker.etag !== "string") ||
        (marker.lastModified != null && typeof marker.lastModified !== "string")
      ) {
        throw new Error(`BONAP county page update marker is invalid for ${row.countyFips}`);
      }
    }
    for (const key of ["etag", "lastModified"]) {
      if (row[key] != null && typeof row[key] !== "string") {
        throw new Error(`BONAP county update marker ${key} is invalid for ${row.countyFips}`);
      }
    }
    if (row.evidenceUse !== "presence_only" || Object.hasOwn(row, "nativityStatus")) {
      throw new Error(`BONAP SpeciesList data cannot be stored as county nativity for ${row.countyFips}`);
    }
    for (const taxon of row.candidateTaxa ?? []) {
      if (!plantIds.includes(taxon.plantId) || !taxon.bonapTaxonId || !taxon.scientificName) {
        throw new Error(`BONAP county occurrence has an unresolved catalog taxon in ${row.countyFips}`);
      }
      expectedDetailIds.add(String(taxon.bonapTaxonId));
    }
    actualCounties.add(row.countyFips);
  }
  if (actualCounties.size !== expectedCounties.size) {
    throw new Error(`BONAP county occurrence snapshot covers ${actualCounties.size} of ${expectedCounties.size} lower-48 counties`);
  }
  const matchedPlantIds = new Set();
  for (const match of bonap.taxonMatches ?? []) {
    if (!plantIds.includes(match.plantId) || matchedPlantIds.has(match.plantId)) {
      throw new Error(`BONAP taxon crosswalk has an unexpected or duplicate plant ${match.plantId}`);
    }
    if (!["exact", "ambiguous", "unresolved"].includes(match.matchStatus)) {
      throw new Error(`BONAP taxon crosswalk status is invalid for ${match.plantId}`);
    }
    matchedPlantIds.add(match.plantId);
  }
  if (matchedPlantIds.size !== plantIds.length) {
    throw new Error(`BONAP taxon crosswalk covers ${matchedPlantIds.size} of ${plantIds.length} catalog taxa`);
  }
  const actualDetailIds = new Set();
  for (const detail of bonap.taxonDetails ?? []) {
    if (
      !detail.bonapTaxonId ||
      !detail.scientificName ||
      detail.evidenceUse !== "identity_and_occurrence_only" ||
      !/^[a-f0-9]{64}$/.test(detail.contentSha256 ?? "") ||
      Object.hasOwn(detail, "nativityStatus")
    ) {
      throw new Error(`BONAP TaxonDetails cannot be stored as county nativity for ${detail.bonapTaxonId}`);
    }
    if (actualDetailIds.has(String(detail.bonapTaxonId))) {
      throw new Error(`BONAP TaxonDetails has duplicate source ID ${detail.bonapTaxonId}`);
    }
    actualDetailIds.add(String(detail.bonapTaxonId));
    for (const key of ["etag", "lastModified"]) {
      if (detail[key] != null && typeof detail[key] !== "string") {
        throw new Error(`BONAP TaxonDetails update marker ${key} is invalid for ${detail.bonapTaxonId}`);
      }
    }
    if (detail.countyOccurrenceMapUrl != null) {
      let occurrenceMapUrl;
      try {
        occurrenceMapUrl = new URL(detail.countyOccurrenceMapUrl);
      } catch {
        throw new Error(`BONAP TaxonDetails county map URL is invalid for ${detail.bonapTaxonId}`);
      }
      if (occurrenceMapUrl.protocol !== "https:" || occurrenceMapUrl.hostname !== "bonap.net" || !occurrenceMapUrl.pathname.startsWith("/MapGallery/County/")) {
        throw new Error(`BONAP TaxonDetails county map is not an official county map for ${detail.bonapTaxonId}`);
      }
    }
  }
  if (expectedDetailIds.size !== actualDetailIds.size || [...expectedDetailIds].some((id) => !actualDetailIds.has(id))) {
    throw new Error(`BONAP TaxonDetails covers ${actualDetailIds.size} of ${expectedDetailIds.size} discovered catalog IDs`);
  }
  const mapByUrl = new Map();
  for (const map of bonap.mapSnapshots ?? []) {
    if (
      !/^https:\/\/bonap\.net\/MapGallery\/County\/[^/]+\.png$/i.test(map.mapUrl ?? "") ||
      !/^[a-f0-9]{64}$/.test(map.sha256 ?? "") ||
      map.mapKeyUrl !== BONAP_URLS.mapKey ||
      !map.retrievedAt ||
      map.assetPath !== `data/natives/bonap-map-snapshots/${map.sha256}.png` ||
      (map.etag != null && typeof map.etag !== "string") ||
      (map.lastModified != null && typeof map.lastModified !== "string") ||
      (map.mapGenerationDate !== null && Number.isNaN(Date.parse(map.mapGenerationDate))) ||
      (map.mapGenerationDate === null ? map.mapGenerationDateSource !== null : !["png_content_metadata", "visual_map_content"].includes(map.mapGenerationDateSource)) ||
      mapByUrl.has(map.mapUrl)
    ) {
      throw new Error("BONAP map snapshot is missing its URL, hash, MapKey, retrieval time, or date marker");
    }
    mapByUrl.set(map.mapUrl, map);
  }
  for (const mapping of bonap.mapMappings ?? []) {
    if (!matchedPlantIds.has(mapping.plantId) || !["exact", "ambiguous", "unresolved"].includes(mapping.mapStatus)) {
      throw new Error(`BONAP map mapping is invalid for ${mapping.plantId}`);
    }
    if (mapping.mapStatus === "exact" && mapByUrl.get(mapping.mapUrl)?.sha256 !== mapping.mapSha256) {
      throw new Error(`BONAP exact map mapping has no captured snapshot for ${mapping.plantId}`);
    }
  }
  const expectedMapPlants = new Set(
    bonap.taxonMatches.filter((match) => match.matchStatus === "exact").map((match) => match.plantId),
  );
  const mappedPlants = new Set((bonap.mapMappings ?? []).map((mapping) => mapping.plantId));
  if (expectedMapPlants.size !== mappedPlants.size || [...expectedMapPlants].some((id) => !mappedPlants.has(id))) {
    throw new Error(`BONAP NAPA map discovery covers ${mappedPlants.size} of ${expectedMapPlants.size} exact catalog taxa`);
  }
  const npin = payload.npin;
  if (!npin || npin.sourceId !== "npin" || !Array.isArray(npin.enrichments)) {
    throw new Error("NPIN enrichment snapshot is missing");
  }
  for (const enrichment of npin.enrichments) {
    if (!plantIds.includes(enrichment.plantId) || enrichment.evidenceUse === "nativity") {
      throw new Error(`NPIN profile data cannot be stored as local nativity for ${enrichment.plantId}`);
    }
    if (!["exact", "ambiguous", "unresolved"].includes(enrichment.matchStatus)) {
      throw new Error(`NPIN taxon match status is invalid for ${enrichment.plantId}`);
    }
    if (!["available", "challenge", "not_attempted"].includes(enrichment.profileStatus)) {
      throw new Error(`NPIN profile status is invalid for ${enrichment.plantId}`);
    }
    if (enrichment.nativityResolution && enrichment.nativityResolution !== "none") {
      throw new Error(`NPIN profile geography cannot resolve county nativity for ${enrichment.plantId}`);
    }
    for (const key of ["autocompleteEtag", "autocompleteLastModified", "profileEtag", "profileLastModified"]) {
      if (enrichment[key] != null && typeof enrichment[key] !== "string") {
        throw new Error(`NPIN update marker ${key} is invalid for ${enrichment.plantId}`);
      }
    }
  }
  const npinPlantIds = new Set(npin.enrichments.map((row) => row.plantId));
  if (npinPlantIds.size !== plantIds.length || npinPlantIds.size !== npin.enrichments.length || plantIds.some((id) => !npinPlantIds.has(id))) {
    throw new Error(`NPIN enrichment snapshot covers ${npinPlantIds.size} of ${plantIds.length} catalog taxa`);
  }
  return payload;
}

export function validateBonapCountyMapReviewFile(payload, plants, countyData = readJson(countyDataPath)) {
  if (
    !payload ||
    payload.version !== "2" ||
    payload.mapKeyUrl !== BONAP_URLS.mapKey ||
    !Array.isArray(payload.records)
  ) {
    throw new Error("BONAP map review file is missing its version, MapKey, or records");
  }
  const canonicalCountyFips = new Set(Object.keys(countyData?.counties ?? {}));
  if (canonicalCountyFips.size === 0) {
    throw new Error("Canonical Census county FIPS set is missing from ZIP-county geography data");
  }
  const lower48Prefixes = new Set(LOWER48.map((state) => state.fips));
  const seenReviews = new Set();
  for (const [index, review] of payload.records.entries()) {
    const path = `records[${index}]`;
    const plant = plants[review.plantId];
    if (!plant) throw new Error(`${path}: unknown plantId ${review.plantId}`);
    let mapUrl;
    try {
      mapUrl = new URL(review.mapUrl);
    } catch {
      throw new Error(`${path}: mapUrl is invalid`);
    }
    if (
      mapUrl.protocol !== "https:" ||
      mapUrl.hostname !== "bonap.net" ||
      !/^\/MapGallery\/County\/[^/]+\.png$/i.test(mapUrl.pathname)
    ) {
      throw new Error(`${path}: mapUrl must be a linked BONAP per-taxon county PNG`);
    }
    let mapTaxonName;
    try {
      mapTaxonName = decodeURIComponent(mapUrl.pathname.slice("/MapGallery/County/".length, -4));
    } catch {
      throw new Error(`${path}: mapUrl taxon name is invalid`);
    }
    if (
      normalizeScientificName(mapTaxonName) !== normalizeScientificName(review.scientificName) ||
      (review.taxonomyMatch === "exact" &&
        normalizeScientificName(review.scientificName) !== normalizeScientificName(plant.scientificName))
    ) {
      throw new Error(`${path}: BONAP map name and taxonomy review do not match the catalog taxon`);
    }
    if (
      !/^[a-f0-9]{64}$/.test(review.mapSha256 ?? "") ||
      !["exact", "ambiguous", "unresolved"].includes(review.taxonomyMatch) ||
      !["confirmed_taxon_scope", "may_conflate_infraspecific", "unresolved"].includes(review.mapScopeDecision) ||
      !["approved", "rejected"].includes(review.reviewStatus) ||
      typeof review.currentStatusConfirmed !== "boolean" ||
      !review.reviewer?.trim() ||
      !review.reviewedAt ||
      Number.isNaN(Date.parse(review.reviewedAt)) ||
      !review.reviewNote?.trim() ||
      !Array.isArray(review.counties)
    ) {
      throw new Error(`${path}: BONAP map review is missing taxonomy, map scope, reviewer, status, or conversion data`);
    }
    const reviewKey = [review.plantId, review.mapUrl, review.mapSha256].join("|");
    if (seenReviews.has(reviewKey)) {
      throw new Error(`${path}: duplicate BONAP map review for plant, URL, and map hash`);
    }
    seenReviews.add(reviewKey);
    if (review.mapGenerationDateFromContent !== null &&
      (typeof review.mapGenerationDateFromContent !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(review.mapGenerationDateFromContent) ||
        Number.isNaN(Date.parse(review.mapGenerationDateFromContent)))) {
      throw new Error(`${path}: mapGenerationDateFromContent must be a date read from the map or null`);
    }
    const seenCounties = new Set();
    for (const county of review.counties) {
      if (
        !/^\d{5}$/.test(county.countyFips ?? "") ||
        !lower48Prefixes.has(county.countyFips.slice(0, 2)) ||
        !String(county.rawCategory ?? "").trim() ||
        seenCounties.has(county.countyFips)
      ) {
        throw new Error(`${path}: county conversion must have unique lower-48 FIPS and preserved raw category`);
      }
      if (!canonicalCountyFips.has(county.countyFips)) {
        throw new Error(`${path}: county FIPS ${county.countyFips} is absent from the canonical Census county set`);
      }
      seenCounties.add(county.countyFips);
    }
  }
  return payload;
}

export async function fetchSupplementalSourceData({
  plants,
  sources,
  countyFipses,
  bonapReviews = [],
  previousFullTaxonList = null,
  verifiedFullTaxonListBytes = BONAP_FULL_TAXON_LIST_VERIFIED_BYTES,
  fetchImpl = fetch,
  now = new Date(),
  onCounty = () => {},
  onPlant = () => {},
  onSource = () => {},
}) {
  const retrievedAt = now.toISOString();
  const sourceCall = async (sourceId, operation) => {
    try {
      return await operation();
    } catch (error) {
      const sourceError = error instanceof Error ? error : new Error(String(error));
      sourceError.sourceId ??= sourceId;
      throw sourceError;
    }
  };
  const bonap = await sourceCall("bonap-napa", () => fetchBonapSourceSnapshot({
    plants,
    countyFipses,
    fetchImpl,
    now,
    previousTaxa: previousFullTaxonList?.taxa ?? [],
    verifiedFullTaxonListBytes,
    onCounty,
  }));
  const maps = await sourceCall("bonap-napa", () => fetchBonapMapSnapshots({
    plants,
    taxonMatches: bonap.taxonMatches,
    fetchImpl,
    now,
  }));
  const mapAssets = maps.snapshots.map((snapshot) => ({
    path: path.join(bonapMapAssetsPath, `${snapshot.sha256}.png`),
    bytes: snapshot.bytes,
  }));
  const bonapMapSnapshots = maps.snapshots.map((snapshot) => {
    const metadata = Object.fromEntries(
      Object.entries(snapshot).filter(([key]) => key !== "bytes"),
    );
    return {
      ...metadata,
      assetPath: `data/natives/bonap-map-snapshots/${snapshot.sha256}.png`,
    };
  });
  const reviewedMapRecords = await sourceCall("bonap-napa", async () => buildBonapCountyEvidence({
    plants,
    mapSnapshots: maps.snapshots,
    reviews: bonapReviews,
    source: sources["bonap-napa"],
  }));
  onSource({ sourceId: "bonap-napa", status: "staged" });
  onSource({ sourceId: "npin", status: "retrieving" });
  const npin = await sourceCall("npin", () =>
    fetchNpinEnrichment({ plants, fetchImpl, now, onPlant }),
  );
  onSource({ sourceId: "npin", status: "staged" });
  const snapshot = {
    version: "1",
    status: "retrieved",
    retrievedAt,
    provenance:
      `Retrieved ${retrievedAt}. BONAP FullTaxonList taxon names have no source-stable ID; TDC Id values remain source-scoped. County SpeciesList and TaxonDetails are recorded for identity and occurrence only. NAPA county maps are discovered from live genus pages and stored by SHA-256; map dates are read from PNG content metadata when available and otherwise remain null for manual content review. County categories become range evidence only through a current-hash approved map review tied to the BONAP MapKey. NPIN autocomplete/profile records are crosswalk and enrichment only; geographic prose never establishes local nativity.`,
    bonap: {
      sourceId: bonap.sourceId,
      retrievedAt: bonap.retrievedAt,
      fullTaxonList: bonap.fullTaxonList,
      taxonMatches: bonap.taxonMatches,
      countyOccurrences: bonap.countyOccurrences,
      taxonDetails: bonap.taxonDetails,
      mapMappings: maps.mappings,
      mapSnapshots: bonapMapSnapshots,
      reviewedMapRecordCount: reviewedMapRecords.length,
    },
    npin,
  };
  await sourceCall("source-validation", async () =>
    validateSourceIngestionSnapshot(snapshot, {
      countyFipses,
      plantIds: Object.keys(plants),
      verifiedFullTaxonListBytes,
    }),
  );
  return { snapshot, reviewedMapRecords, mapAssets };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export async function main() {
  const startedAt = new Date().toISOString();
  const statusPath = process.env.NATIVE_SOURCE_REFRESH_STATUS_PATH ??
    path.join(root, "data/natives/native-source-refresh-status.json");
  let stage = "load";
  let rangeEvidence = null;
  let sourceIngestion = null;
  let runStatus = createNativeRefreshStatus({ startedAt });
  const persistStatus = () => persistNativeRefreshStatus(statusPath, runStatus);
  const markSource = (sourceId, sourceStatus) => {
    runStatus.sources[sourceId].status = sourceStatus;
    persistStatus();
  };
  persistStatus();
  try {
    const plants = readJson(plantsPath).plants;
    const sourcesFile = readJson(sourcesPath);
    rangeEvidence = readJson(rangeEvidencePath);
    const countyData = readJson(countyDataPath);
    sourceIngestion = readJson(sourceIngestionPath);
    runStatus = createNativeRefreshStatus({ startedAt, rangeEvidence, sourceIngestion });
    persistStatus();
    const bonapReviewFile = validateBonapCountyMapReviewFile(
      readJson(bonapReviewsPath),
      plants,
      countyData,
    );
    const bonapReviews = bonapReviewFile.records;
    console.log(
      `current supplemental snapshot=${sourceIngestion.status ?? (sourceIngestion.retrievedAt ? "retrieved" : "not_refreshed")} retrievedAt=${sourceIngestion.retrievedAt ?? "none"}`,
    );
    const reportSourceEvidence = (label, records, bonapMapSnapshots = [], bonapReviewRecords = []) => {
      for (const summary of summarizeNativeSourceEvidence(
        sourcesFile.sources,
        records,
        LOWER48,
        bonapMapSnapshots,
        bonapReviewRecords,
      )) {
        console.log(
          `snapshot=${label} source=${summary.sourceId} owner=${summary.ownerAuthorizationStatus} terms=${summary.sourceTermsStatus} enabled=${summary.rangeEvidenceAvailable} records=${summary.recordCount} lower48Counties=${summary.lower48CountyFipsCount} states=${summary.statesWithCountyEvidence.map((state) => state.stateCode ?? state.stateFips).join(",") || "none"}`,
        );
      }
    };
    reportSourceEvidence(
      "current",
      rangeEvidence.records,
      sourceIngestion.bonap?.mapSnapshots ?? [],
      bonapReviews,
    );

    stage = "usda-plants";
    markSource(stage, "retrieving");
    const countyBoundaryIndex = await fetchCountyFipsIndex();
    const usdaNext = await fetchRangeEvidence({
      plants,
      sources: sourcesFile.sources,
      countyBoundaryIndex,
      onPlant: ({ id, symbol, recordCount }) =>
        console.log(`${symbol} (${id}): ${recordCount} county records`),
    });
    markSource(stage, "staged");

    stage = "bonap-napa";
    markSource(stage, "retrieving");
    const countyFipses = lower48CountyFipses(countyData);
    const supplemental = await fetchSupplementalSourceData({
      plants,
      sources: sourcesFile.sources,
      countyFipses,
      bonapReviews,
      previousFullTaxonList: sourceIngestion.bonap?.fullTaxonList ?? null,
      onCounty: ({ countyFips, index, total, occurrenceTaxonCount }) => {
        if (index % 100 === 0 || index === total) {
          console.log(`BONAP TDC county=${countyFips} occurrenceTaxa=${occurrenceTaxonCount} progress=${index}/${total}`);
        }
      },
      onPlant: ({ plantId, status }) => console.log(`NPIN ${plantId}: ${status}`),
      onSource: ({ sourceId, status }) => markSource(sourceId, status),
    });
    markSource("bonap-napa", "staged");
    markSource("npin", "staged");

    stage = "source-validation";
    const next = {
      version: `native-sources-live-${new Date().toISOString().slice(0, 10)}`,
      provenance: `${usdaNext.provenance} BONAP reviewed map records are included only when current map hash, exact taxonomy, review approval, and current-status confirmation match. TDC records and NPIN data remain discovery or enrichment, never local claims.`,
      records: [...usdaNext.records, ...supplemental.reviewedMapRecords],
    };
    const rangeValidation = {
      plantIds: Object.keys(plants),
      sources: sourcesFile.sources,
      bonapMapSnapshots: supplemental.snapshot.bonap.mapSnapshots,
      bonapReviewRecords: bonapReviews,
    };
    validateRangeEvidenceFile(next, rangeValidation);
    const changes = discoverRangeEvidenceChanges(rangeEvidence, next);
    console.log(`records=${next.records.length} discovery=${JSON.stringify(changes)}`);
    console.log(
      `BONAP taxa=${supplemental.snapshot.bonap.fullTaxonList.taxonCount} exactCatalogMatches=${supplemental.snapshot.bonap.taxonMatches.filter((row) => row.matchStatus === "exact").length} occurrenceCounties=${supplemental.snapshot.bonap.countyOccurrences.length} mapSnapshots=${supplemental.snapshot.bonap.mapSnapshots.length} reviewedRecords=${supplemental.reviewedMapRecords.length}`,
    );
    console.log(
      `NPIN exactCrosswalks=${supplemental.snapshot.npin.enrichments.filter((row) => row.matchStatus === "exact").length} profiles=${supplemental.snapshot.npin.enrichments.filter((row) => row.profileStatus === "available").length} challenges=${supplemental.snapshot.npin.enrichments.filter((row) => row.profileStatus === "challenge").length}`,
    );
    reportSourceEvidence(
      "staged",
      next.records,
      supplemental.snapshot.bonap.mapSnapshots,
      bonapReviews,
    );

    if (!write) {
      runStatus.status = "validated";
      runStatus.completedAt = new Date().toISOString();
      for (const source of Object.values(runStatus.sources)) {
        if (source.status === "staged") source.status = "validated";
      }
      persistStatus();
      console.log("dry-run (pass --write to stage, validate, and replace the last-good evidence and source snapshots)");
      return;
    }
    stage = "publication";
    commitNativeEvidenceSnapshotAtomically({
      rangeEvidencePath,
      rangeEvidence: next,
      rangeValidation,
      sourceIngestionPath,
      sourceIngestion: supplemental.snapshot,
      sourceValidation: { countyFipses, plantIds: Object.keys(plants) },
      mapAssets: supplemental.mapAssets,
    });
    runStatus.status = "succeeded";
    runStatus.completedAt = new Date().toISOString();
    runStatus.lastGoodSnapshotRetrievedAt = supplemental.snapshot.retrievedAt;
    for (const source of Object.values(runStatus.sources)) {
      source.status = "published";
      source.lastSuccessAt = runStatus.completedAt;
    }
    persistStatus();
    console.log(`wrote ${rangeEvidencePath} and ${sourceIngestionPath}`);
  } catch (error) {
    failNativeRefreshStatus({
      filePath: statusPath,
      status: runStatus,
      error,
      stage,
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
