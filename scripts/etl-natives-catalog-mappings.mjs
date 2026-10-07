#!/usr/bin/env node
/**
 * Build regional and exact-ZCTA candidate catalogs from refreshed USDA county
 * claims.
 *
 *   pnpm run etl:natives-catalog-mappings           # preview
 *   pnpm run etl:natives-catalog-mappings -- --write # publish atomically
 *
 * An EPA L3 catalog is the union of candidate species with an eligible USDA
 * Native county claim in a county intersecting that L3. An exact ZCTA
 * override is narrower: it contains only plants with an eligible Native claim
 * in every Census county intersection for that ZCTA. If no such exact set is
 * available, the override records the regional fallback explicitly. Neither
 * catalog membership nor a fallback is itself nativity evidence.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isEligibleRangeEvidenceClaim } from "./lib/native-claim-eligibility.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const countyPath = path.join(root, "data/natives/zip-county.json");
const ecoregionPath = path.join(root, "data/natives/zip-ecoregion.json");
const plantsPath = path.join(root, "data/natives/plants.json");
const sourcesPath = path.join(root, "data/natives/native-sources.json");
const evidencePath = path.join(root, "data/natives/plant-range-evidence.json");
const ecoregionPlantsPath = path.join(root, "data/natives/ecoregion-plants.json");
const zctaCatalogPath = path.join(root, "data/natives/zcta-catalog.json");
const centroidsPath = path.join(root, "data/zctaCentroids.json");
const write = process.argv.includes("--write");

export const LOWER48_STATE_FIPS = new Set([
  "01", "04", "05", "06", "08", "09", "10", "12", "13", "16", "17", "18",
  "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
  "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42",
  "44", "45", "46", "47", "48", "49", "50", "51", "53", "54", "55", "56",
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function uniqueCountyFips(intersections) {
  return [...new Set((intersections ?? []).map((row) => row.fips).filter((fips) => /^\d{5}$/.test(fips)))].sort();
}

function buildNativeCountyIndex(records, sources) {
  const byPlant = new Map();
  for (const record of records) {
    if (
      record.sourceId !== "usda-plants" ||
      record.spatialResolution !== "county" ||
      record.nativityStatus !== "native" ||
      !/^\d{5}$/.test(record.countyFips ?? "") ||
      !isEligibleRangeEvidenceClaim(record, sources)
    ) continue;
    const counties = byPlant.get(record.plantId) ?? new Set();
    counties.add(record.countyFips);
    byPlant.set(record.plantId, counties);
  }
  return byPlant;
}

export function candidateIdsForCounties(countyFipses, nativeCountyIndex, plantIds, mode = "all") {
  const wanted = [...new Set(countyFipses)];
  if (wanted.length === 0) return [];
  return plantIds
    .filter((plantId) => {
      const claims = nativeCountyIndex.get(plantId);
      if (!claims) return false;
      return mode === "any"
        ? wanted.some((fips) => claims.has(fips))
        : wanted.every((fips) => claims.has(fips));
    })
    .sort();
}

function buildEcoregionCatalog({ countyData, ecoregionData, nativeCountyIndex, plantIds }) {
  const countiesByEcoregion = new Map();
  for (const [zip, ecoregionId] of Object.entries(ecoregionData.zips ?? {})) {
    const countyFipses = uniqueCountyFips(countyData.intersections?.[zip]);
    const counties = countiesByEcoregion.get(ecoregionId) ?? new Set();
    for (const fips of countyFipses) counties.add(fips);
    countiesByEcoregion.set(ecoregionId, counties);
  }

  const ecoregions = {};
  for (const [ecoregionId, name] of Object.entries(ecoregionData.names ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const countyFipses = [...(countiesByEcoregion.get(ecoregionId) ?? [])];
    const ids = candidateIdsForCounties(countyFipses, nativeCountyIndex, plantIds, "any");
    if (ids.length === 0) {
      throw new Error(`EPA L3 ${ecoregionId} (${name}) has no USDA-native candidate plants`);
    }
    ecoregions[ecoregionId] = {
      ecoregionId,
      name,
      plantIds: ids,
      provenance:
        `Candidate catalog derived from ${ids.length} catalog species with an eligible USDA PLANTS Native county claim in at least one Census county intersecting EPA Level III ecoregion ${ecoregionId}. Membership is not a local nativity assertion; exact-ZCTA evidence is evaluated separately.`,
    };
  }
  return ecoregions;
}

function squaredDistance(left, right) {
  const latitudeScale = Math.cos((left.lat * Math.PI) / 180);
  const dx = (left.lon - right.lon) * latitudeScale;
  const dy = left.lat - right.lat;
  return dx * dx + dy * dy;
}

function nearestMappedZip(zip, centroids, mappedEcoregionZips) {
  const target = centroids?.[zip];
  if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lon)) return null;
  let best = null;
  for (const candidateZip of mappedEcoregionZips) {
    const candidate = centroids[candidateZip];
    if (!candidate || candidateZip === zip) continue;
    const distance = squaredDistance(target, candidate);
    if (!best || distance < best.distance) best = { zip: candidateZip, distance };
  }
  return best;
}

export function buildZctaCatalog({
  countyData,
  ecoregionData,
  ecoregionCatalog,
  nativeCountyIndex,
  plantIds,
  centroids = {},
}) {
  const zctas = {};
  const mappedEcoregionZips = new Set(Object.keys(ecoregionData.zips ?? {}));
  let exactOverrideCount = 0;
  let regionalFallbackCount = 0;
  let nearestFallbackCount = 0;
  let noCatalogCount = 0;

  for (const [zip, intersections] of Object.entries(countyData.intersections ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const stateFips = intersections?.[0]?.stateFips;
    if (!LOWER48_STATE_FIPS.has(stateFips)) continue;
    const countyFipses = uniqueCountyFips(intersections);
    const exactPlantIds = candidateIdsForCounties(countyFipses, nativeCountyIndex, plantIds, "all");
    const ecoregionId = ecoregionData.zips?.[zip] ?? null;
    if (exactPlantIds.length > 0) {
      zctas[zip] = {
        plantIds: exactPlantIds,
        ecoregionId,
        mappingBasis: "all_intersecting_counties_have_usda_native_claim",
      };
      exactOverrideCount++;
      continue;
    }

    if (ecoregionId && ecoregionCatalog[ecoregionId]) {
      zctas[zip] = {
        plantIds: ecoregionCatalog[ecoregionId].plantIds,
        ecoregionId,
        mappingBasis: "epa_l3_catalog_fallback_when_no_complete_zcta_native_intersection",
      };
      regionalFallbackCount++;
      continue;
    }

    const nearest = nearestMappedZip(zip, centroids, mappedEcoregionZips);
    const nearestEcoregionId = nearest ? ecoregionData.zips[nearest.zip] : null;
    if (nearestEcoregionId && ecoregionCatalog[nearestEcoregionId]) {
      zctas[zip] = {
        plantIds: ecoregionCatalog[nearestEcoregionId].plantIds,
        ecoregionId: null,
        fallbackEcoregionId: nearestEcoregionId,
        fallbackSourceZip: nearest.zip,
        mappingBasis: "nearest_zcta_epa_l3_catalog_fallback_centroid_outside_epa_polygon",
      };
      nearestFallbackCount++;
      continue;
    }

    zctas[zip] = {
      plantIds: [],
      ecoregionId,
      mappingBasis: "no_candidate_evidence",
    };
    noCatalogCount++;
  }

  return {
    version: "zcta-usda-native-catalog-v1",
    provenance:
      "Exact ZCTA candidate overrides use only catalog plants with eligible USDA PLANTS Native county claims in every Census county intersection. ZCTAs without a complete exact set retain an explicitly labeled EPA L3 candidate fallback; ZCTAs whose centroid misses EPA polygons use a nearest mapped-ZCTA catalog fallback without inventing an ecoregion assignment. Candidate membership never establishes nativity; the range-evidence gate remains authoritative.",
    zctaCount: Object.keys(zctas).length,
    exactOverrideCount,
    regionalFallbackCount,
    nearestFallbackCount,
    noCatalogCount,
    zctas,
  };
}

/** Replace repeated per-ZCTA ID arrays with a deterministic shared-set table. */
export function compressZctaCatalog(catalog) {
  const setKeys = new Set(
    Object.values(catalog.zctas).map((entry) => entry.plantIds.join(",")),
  );
  const orderedSetKeys = [...setKeys].sort();
  const plantSets = orderedSetKeys.map((key) => (key ? key.split(",") : []));
  const setIds = new Map(orderedSetKeys.map((key, index) => [key, index]));
  const zctas = Object.fromEntries(
    Object.entries(catalog.zctas).map(([zip, entry]) => {
      const key = entry.plantIds.join(",");
      const { plantIds: _plantIds, ...metadata } = entry;
      return [zip, { ...metadata, plantSetId: setIds.get(key) }];
    }),
  );
  return {
    ...catalog,
    version: "zcta-usda-native-catalog-v2",
    plantSets,
    zctas,
  };
}

function writeAtomically(filePath, value) {
  const stagedPath = `${filePath}.staged`;
  fs.writeFileSync(stagedPath, `${JSON.stringify(value, null, 2)}\n`);
  try {
    fs.renameSync(stagedPath, filePath);
  } catch (error) {
    fs.rmSync(stagedPath, { force: true });
    throw error;
  }
}

export function main() {
  const countyData = readJson(countyPath);
  const ecoregionData = readJson(ecoregionPath);
  const plants = readJson(plantsPath).plants;
  const sources = readJson(sourcesPath).sources;
  const evidence = readJson(evidencePath).records;
  const nativeCountyIndex = buildNativeCountyIndex(evidence, sources);
  const plantIds = Object.keys(plants).sort();
  const ecoregionCatalog = buildEcoregionCatalog({
    countyData,
    ecoregionData,
    nativeCountyIndex,
    plantIds,
  });
  const zctaCatalog = compressZctaCatalog(buildZctaCatalog({
    countyData,
    ecoregionData,
    ecoregionCatalog,
    nativeCountyIndex,
    plantIds,
    centroids: fs.existsSync(centroidsPath) ? readJson(centroidsPath) : {},
  }));
  console.log(
    `ecoregions=${Object.keys(ecoregionCatalog).length} zctas=${zctaCatalog.zctaCount} exactOverrides=${zctaCatalog.exactOverrideCount} regionalFallbacks=${zctaCatalog.regionalFallbackCount} nearestFallbacks=${zctaCatalog.nearestFallbackCount} noCatalog=${zctaCatalog.noCatalogCount}`,
  );
  if (!write) {
    console.log("dry-run (pass --write to save)");
    return;
  }
  writeAtomically(ecoregionPlantsPath, {
    version: "epa-l3-usda-native-catalog-v1",
    provenance:
      "EPA Level III candidate catalogs derived from the USDA PLANTS county evidence refresh. Each L3 contains plants with an eligible Native claim in at least one intersecting Census county; catalog membership is not local nativity evidence. Exact ZCTA overrides are stored separately in zcta-catalog.json.",
    ecoregions: ecoregionCatalog,
  });
  writeAtomically(zctaCatalogPath, zctaCatalog);
  console.log(`wrote ${ecoregionPlantsPath}`);
  console.log(`wrote ${zctaCatalogPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
