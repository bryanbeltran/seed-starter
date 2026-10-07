#!/usr/bin/env node
/**
 * Materialize explicit unknown coverage markers for catalog candidate/county
 * pairs with no eligible USDA or reviewed BONAP record.
 *
 * A missing source row is not a non-native claim. The marker records that the
 * completed USDA county-layer refresh returned no eligible local claim for the
 * pair, so downstream coverage can distinguish an audited unknown from an
 * unqueried gap. It never makes a recommendation affirmative.
 *
 *   pnpm run etl:natives-local-evidence-gaps           # preview
 *   pnpm run etl:natives-local-evidence-gaps -- --write # publish atomically
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isEligibleRangeEvidenceClaim } from "./lib/native-claim-eligibility.mjs";
import { validateRangeEvidenceFile } from "./etl-natives-range-evidence.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "data/natives/zcta-catalog.json");
const countyPath = path.join(root, "data/natives/zip-county.json");
const plantsPath = path.join(root, "data/natives/plants.json");
const sourcesPath = path.join(root, "data/natives/native-sources.json");
const evidencePath = path.join(root, "data/natives/plant-range-evidence.json");
const ingestionPath = path.join(root, "data/natives/native-source-ingestion.json");
const reviewsPath = path.join(root, "data/natives/bonap-county-map-reviews.json");
const refreshStatusPath = path.join(root, "data/natives/native-source-refresh-status.json");
const write = process.argv.includes("--write");
const COUNTY_LAYER_URL =
  "https://apps.geo.fpac.usda.gov/nrcs-geodata/rest/services/land_use_land_cover/plants/MapServer/6";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function uniqueCountyFips(intersections) {
  return [...new Set(
    (intersections ?? [])
      .map((intersection) => intersection.fips)
      .filter((fips) => /^[0-9]{5}$/.test(fips ?? "")),
  )].sort();
}

function countyDescription(countyData, countyFips) {
  const county = countyData.counties?.[countyFips];
  return county?.name && county?.state
    ? `${county.name}, ${county.state}`
    : `county FIPS ${countyFips}`;
}

function retrievalTime(records, refreshStatus) {
  const recordTimes = records
    .filter((record) => record.sourceId === "usda-plants" && record.retrievedAt)
    .map((record) => record.retrievedAt)
    .sort();
  return recordTimes.at(-1) ?? refreshStatus?.sources?.["usda-plants"]?.lastSuccessAt ?? null;
}

export function buildLocalEvidenceCoverageRecords({
  catalog,
  countyData,
  plants,
  sources,
  records,
  mapSnapshots = [],
  bonapReviewRecords = [],
  retrievedAt,
}) {
  const existingCountyPairs = new Set();
  const finerByPlantAndZcta = new Set();
  for (const record of records) {
    if (record.spatialResolution === "finer" && /^[0-9]{5}$/.test(record.finerArea?.zctaId ?? "")) {
      if (isEligibleRangeEvidenceClaim(record, sources, mapSnapshots, record.finerArea.zctaId, bonapReviewRecords)) {
        finerByPlantAndZcta.add(`${record.plantId}|${record.finerArea.zctaId}`);
      }
    }
    if (record.spatialResolution !== "county" || !/^[0-9]{5}$/.test(record.countyFips ?? "")) continue;
    if (!isEligibleRangeEvidenceClaim(record, sources, mapSnapshots, null, bonapReviewRecords)) continue;
    existingCountyPairs.add(`${record.plantId}|${record.countyFips}`);
  }

  const missingPairs = new Map();
  for (const [zcta, entry] of Object.entries(catalog.zctas ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
    const countyFipses = uniqueCountyFips(countyData.intersections?.[zcta]);
    const candidateIds = catalog.plantSets?.[entry.plantSetId] ?? [];
    for (const plantId of candidateIds) {
      if (finerByPlantAndZcta.has(`${plantId}|${zcta}`)) continue;
      for (const countyFips of countyFipses) {
        const key = `${plantId}|${countyFips}`;
        if (!existingCountyPairs.has(key)) missingPairs.set(key, { plantId, countyFips });
      }
    }
  }

  const source = sources["usda-plants"];
  if (!source?.licenseNote?.trim()) throw new Error("USDA PLANTS license note is missing");
  const plantById = plants;
  return [...missingPairs.values()]
    .sort((left, right) => `${left.plantId}|${left.countyFips}`.localeCompare(`${right.plantId}|${right.countyFips}`))
    .map(({ plantId, countyFips }) => {
      const plant = plantById[plantId];
      if (!plant) throw new Error(`Catalog references unknown plant ${plantId}`);
      const location = countyDescription(countyData, countyFips);
      return {
        plantId,
        sourceId: "usda-plants",
        sourceCitation:
          `USDA, NRCS. PLANTS Database. ${plant.scientificName}. Completed Counties ` +
          `MapServer refresh returned no county feature for ${location} (county FIPS ${countyFips}); ` +
          "this explicit coverage marker is retained as unknown.",
        sourceUrl: COUNTY_LAYER_URL,
        releaseOrObservationDate: null,
        retrievedAt,
        licenseNote: source.licenseNote,
        geographicScope: `County or county-equivalent: ${location}.`,
        spatialResolution: "county",
        countyFips,
        nativityStatus: "unknown",
        uncertainty:
          "No eligible USDA PLANTS county-layer claim was returned for this plant/county pair in the completed refresh. " +
          "Absence is preserved as unknown and is not evidence of non-native status.",
      };
    });
}

export function buildLocalEvidenceCoverageSnapshot({
  catalog,
  countyData,
  plants,
  sources,
  evidence,
  ingestion,
  reviews,
  refreshStatus,
}) {
  const markers = buildLocalEvidenceCoverageRecords({
    catalog,
    countyData,
    plants,
    sources,
    records: evidence.records,
    mapSnapshots: ingestion.bonap?.mapSnapshots ?? [],
    bonapReviewRecords: reviews.records ?? [],
    retrievedAt: retrievalTime(evidence.records, refreshStatus),
  });
  const next = {
    ...evidence,
    provenance:
      `${evidence.provenance} Explicit USDA county-coverage markers are generated for ` +
      "catalog candidate/county pairs with no eligible claim after the completed refresh; " +
      "they remain unknown and never establish nativity.",
    records: [...evidence.records, ...markers],
  };
  validateRangeEvidenceFile(next, {
    plantIds: Object.keys(plants),
    sources,
    bonapMapSnapshots: ingestion.bonap?.mapSnapshots ?? [],
    bonapReviewRecords: reviews.records ?? [],
  });
  return { payload: next, markers };
}

function writeAtomically(filePath, payload) {
  const stagedPath = `${filePath}.staged`;
  fs.writeFileSync(stagedPath, `${JSON.stringify(payload)}\n`);
  try {
    fs.renameSync(stagedPath, filePath);
  } catch (error) {
    fs.rmSync(stagedPath, { force: true });
    throw error;
  }
}

function main() {
  const catalog = readJson(catalogPath);
  const countyData = readJson(countyPath);
  const plantsFile = readJson(plantsPath);
  const sourcesFile = readJson(sourcesPath);
  const evidence = readJson(evidencePath);
  const ingestion = readJson(ingestionPath);
  const reviews = readJson(reviewsPath);
  const refreshStatus = readJson(refreshStatusPath);
  const { payload, markers } = buildLocalEvidenceCoverageSnapshot({
    catalog,
    countyData,
    plants: plantsFile.plants,
    sources: sourcesFile.sources,
    evidence,
    ingestion,
    reviews,
    refreshStatus,
  });
  console.log(JSON.stringify({
    existingRecordCount: evidence.records.length,
    coverageMarkerCount: markers.length,
    nextRecordCount: payload.records.length,
    retrievedAt: markers[0]?.retrievedAt ?? null,
  }, null, 2));
  if (write) {
    writeAtomically(evidencePath, payload);
    console.log(`wrote ${evidencePath}`);
  }
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
