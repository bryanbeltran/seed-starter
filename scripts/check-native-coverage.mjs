#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeNativeSourceEvidence } from "./lib/native-source-evidence.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const LOWER48 = [
  ["AL", "Alabama", "01"], ["AZ", "Arizona", "04"],
  ["AR", "Arkansas", "05"], ["CA", "California", "06"],
  ["CO", "Colorado", "08"], ["CT", "Connecticut", "09"],
  ["DE", "Delaware", "10"], ["FL", "Florida", "12"],
  ["GA", "Georgia", "13"], ["ID", "Idaho", "16"],
  ["IL", "Illinois", "17"], ["IN", "Indiana", "18"],
  ["IA", "Iowa", "19"], ["KS", "Kansas", "20"],
  ["KY", "Kentucky", "21"], ["LA", "Louisiana", "22"],
  ["ME", "Maine", "23"], ["MD", "Maryland", "24"],
  ["MA", "Massachusetts", "25"], ["MI", "Michigan", "26"],
  ["MN", "Minnesota", "27"], ["MS", "Mississippi", "28"],
  ["MO", "Missouri", "29"], ["MT", "Montana", "30"],
  ["NE", "Nebraska", "31"], ["NV", "Nevada", "32"],
  ["NH", "New Hampshire", "33"], ["NJ", "New Jersey", "34"],
  ["NM", "New Mexico", "35"], ["NY", "New York", "36"],
  ["NC", "North Carolina", "37"], ["ND", "North Dakota", "38"],
  ["OH", "Ohio", "39"], ["OK", "Oklahoma", "40"],
  ["OR", "Oregon", "41"], ["PA", "Pennsylvania", "42"],
  ["RI", "Rhode Island", "44"], ["SC", "South Carolina", "45"],
  ["SD", "South Dakota", "46"], ["TN", "Tennessee", "47"],
  ["TX", "Texas", "48"], ["UT", "Utah", "49"],
  ["VT", "Vermont", "50"], ["VA", "Virginia", "51"],
  ["WA", "Washington", "53"], ["WV", "West Virginia", "54"],
  ["WI", "Wisconsin", "55"], ["WY", "Wyoming", "56"],
].map(([code, name, fips]) => ({ code, name, fips }));

function indexRangeEvidence(records) {
  const byPlantId = new Map();
  let unresolvedCountyFipsRecordCount = 0;
  for (const record of records) {
    if (record.countyFips === null) unresolvedCountyFipsRecordCount++;
    let byCountyFips = byPlantId.get(record.plantId);
    if (!byCountyFips) {
      byCountyFips = new Map();
      byPlantId.set(record.plantId, byCountyFips);
    }
    let claims = byCountyFips.get(record.countyFips);
    if (!claims) {
      claims = [];
      byCountyFips.set(record.countyFips, claims);
    }
    claims.push(record);
  }
  return { byPlantId, unresolvedCountyFipsRecordCount };
}

function validLocalClaims(plantId, countyFips, evidenceByPlantAndCounty, sources) {
  const claims = evidenceByPlantAndCounty.get(plantId)?.get(countyFips) ?? [];
  return claims.filter((record) => {
    const source = sources[record.sourceId];
    let sourceUrl;
    try {
      sourceUrl = new URL(record.sourceUrl);
    } catch {
      return false;
    }
    const hostname = sourceUrl.hostname;
    return (
      record.plantId === plantId &&
      record.countyFips === countyFips &&
      (record.spatialResolution === "county" ||
        record.spatialResolution === "finer") &&
      source?.authority === "USDA PLANTS" &&
      source.rangeEvidenceAvailable &&
      sourceUrl.protocol === "https:" &&
      (hostname === "usda.gov" || hostname.endsWith(".usda.gov")) &&
      record.sourceCitation?.toUpperCase().includes("USDA")
    );
  });
}

function affirmativeClaims(claims, sources) {
  return (
    claims.length > 0 &&
    claims.every(
      (claim) =>
        claim.nativityStatus === "native" &&
        claim.licenseNote?.trim() &&
        sources[claim.sourceId]?.licenseNote?.trim(),
    )
  );
}

function notNativeClaims(claims, sources) {
  return (
    claims.length > 0 &&
    claims.every(
      (claim) =>
        claim.nativityStatus === "not_native" &&
        claim.licenseNote?.trim() &&
        sources[claim.sourceId]?.licenseNote?.trim(),
    )
  );
}

function countyIntersectionsForZip(countyData, zip) {
  const intersections = countyData.intersections?.[zip];
  if (Array.isArray(intersections)) return intersections;

  const fips = countyData.zips?.[zip];
  if (!fips) return [];
  const state = countyData.counties?.[fips]?.state;
  const stateFips = LOWER48.find((candidate) => candidate.code === state)?.fips;
  return [{ fips, ...(stateFips ? { stateFips } : {}) }];
}

function stateForIntersection(intersection, countyData, byFips, byCode) {
  if (intersection.stateFips) {
    return byFips.get(String(intersection.stateFips).padStart(2, "0"));
  }
  return byCode.get(countyData.counties?.[intersection.fips]?.state);
}

function hasUnresolvedCountyMetadata(countyData, intersection, state) {
  const county = countyData.counties?.[intersection.fips];
  return (
    !county?.name ||
    !county.state ||
    county.state === "??" ||
    county.state !== state.code
  );
}

export function buildNativeCoverageReport({
  countyData,
  ecoregionData,
  ecoregionPlants,
  plants,
  sources,
  rangeEvidence,
}) {
  const byFips = new Map(LOWER48.map((state) => [state.fips, state]));
  const byCode = new Map(LOWER48.map((state) => [state.code, state]));
  const { byPlantId: evidenceByPlantAndCounty, unresolvedCountyFipsRecordCount } =
    indexRangeEvidence(rangeEvidence);
  const stateStats = new Map(
    LOWER48.map((state) => [
      state.code,
      {
        ...state,
        zctas: new Set(),
        countyMappedZctas: new Set(),
        ecoregionMappedZctas: new Set(),
        catalogMappedZctas: new Set(),
        localRangeEvidenceZctas: new Set(),
        affirmativeRangeEvidenceZctas: new Set(),
        notNativeEvidenceZctas: new Set(),
        countyMetadataGapZctas: new Set(),
        countyFips: new Set(),
      },
    ]),
  );

  const lower48Zctas = new Set();
  const primaryCountyNameResolvedZctas = new Set();
  const countyMappedZctas = new Set();
  const ecoregionMappedZctas = new Set();
  const catalogMappedZctas = new Set();
  const catalogMappedZctasWithResolvedPrimaryCounty = new Set();
  const localRangeEvidenceZctas = new Set();
  const affirmativeRangeEvidenceZctas = new Set();
  const notNativeEvidenceZctas = new Set();
  const countyMetadataGapZctas = new Set();
  const countyMetadataGapsByFips = new Map();
  let nonLower48ZctaCount = 0;
  let unresolvedCountyStateZctaCount = 0;

  const zipKeys = new Set([
    ...Object.keys(countyData.zips ?? {}),
    ...Object.keys(countyData.intersections ?? {}),
  ]);
  for (const zip of zipKeys) {
    const intersections = countyIntersectionsForZip(countyData, zip);
    const stateByCode = new Map();
    let hasUnresolvedState = intersections.length === 0;
    let hasKnownOutsideLower48 = false;
    for (const intersection of intersections) {
      const state = stateForIntersection(intersection, countyData, byFips, byCode);
      if (!state) {
        if (/^\d{2}$/.test(String(intersection.stateFips ?? ""))) {
          hasKnownOutsideLower48 = true;
        } else {
          hasUnresolvedState = true;
        }
        continue;
      }
      stateByCode.set(state.code, state);
    }

    if (stateByCode.size === 0) {
      if (hasUnresolvedState && !hasKnownOutsideLower48) {
        unresolvedCountyStateZctaCount++;
      } else {
        nonLower48ZctaCount++;
      }
      continue;
    }

    lower48Zctas.add(zip);
    const primaryFips = countyData.zips?.[zip];
    const primaryCounty = primaryFips ? countyData.counties?.[primaryFips] : null;
    if (primaryCounty?.name) primaryCountyNameResolvedZctas.add(zip);
    const intersectionsByState = new Map();
    for (const intersection of intersections) {
      const state = stateForIntersection(intersection, countyData, byFips, byCode);
      if (!state) continue;
      const group = intersectionsByState.get(state.code) ?? [];
      group.push(intersection);
      intersectionsByState.set(state.code, group);
    }

    for (const [stateCode, stateIntersections] of intersectionsByState) {
      const stats = stateStats.get(stateCode);
      stats.zctas.add(zip);
      const countyFipses = [...new Set(stateIntersections.map((row) => row.fips))];
      const validFipses = countyFipses.filter((fips) => /^\d{5}$/.test(fips));
      if (validFipses.length > 0) {
        countyMappedZctas.add(zip);
        stats.countyMappedZctas.add(zip);
        for (const fips of validFipses) stats.countyFips.add(fips);
      }

      for (const intersection of stateIntersections) {
        if (!hasUnresolvedCountyMetadata(countyData, intersection, stateByCode.get(stateCode))) {
          continue;
        }
        countyMetadataGapZctas.add(zip);
        stats.countyMetadataGapZctas.add(zip);
        const entry = countyMetadataGapsByFips.get(intersection.fips) ?? {
          countyFips: intersection.fips,
          state: stateByCode.get(stateCode).name,
          stateCode,
          zctaCount: 0,
        };
        entry.zctaCount++;
        countyMetadataGapsByFips.set(intersection.fips, entry);
      }

      const ecoregionId = ecoregionData.zips[zip];
      if (!ecoregionId || !ecoregionData.names[ecoregionId]) continue;
      ecoregionMappedZctas.add(zip);
      stats.ecoregionMappedZctas.add(zip);

      const candidateIds = ecoregionPlants.ecoregions[ecoregionId]?.plantIds ?? [];
      const knownCandidateIds = candidateIds.filter((id) => plants[id]);
      if (knownCandidateIds.length === 0) continue;
      catalogMappedZctas.add(zip);
      stats.catalogMappedZctas.add(zip);
      if (primaryCounty?.name) {
        catalogMappedZctasWithResolvedPrimaryCounty.add(zip);
      }

      const localClaimsByPlant = knownCandidateIds.map((plantId) => {
        const claimsByCounty = countyFipses.map((fips) =>
          validLocalClaims(plantId, fips, evidenceByPlantAndCounty, sources),
        );
        return { claimsByCounty, claims: claimsByCounty.flat() };
      });
      const localClaims = localClaimsByPlant.flatMap((result) => result.claims);
      if (localClaims.length > 0) {
        localRangeEvidenceZctas.add(zip);
        stats.localRangeEvidenceZctas.add(zip);
      }
      if (
        localClaimsByPlant.some(({ claimsByCounty }) =>
          claimsByCounty.some((claims) => affirmativeClaims(claims, sources)),
        )
      ) {
        affirmativeRangeEvidenceZctas.add(zip);
        stats.affirmativeRangeEvidenceZctas.add(zip);
      }
      if (
        localClaimsByPlant.some(({ claimsByCounty }) =>
          claimsByCounty.some((claims) => notNativeClaims(claims, sources)),
        )
      ) {
        notNativeEvidenceZctas.add(zip);
        stats.notNativeEvidenceZctas.add(zip);
      }
    }
  }

  const states = [...stateStats.values()].map((stats) => {
    const catalogStatus =
      stats.catalogMappedZctas.size === 0
        ? "none"
        : stats.catalogMappedZctas.size === stats.zctas.size
          ? "full"
          : "partial";
    return {
      state: stats.name,
      stateCode: stats.code,
      zctaCount: stats.zctas.size,
      countyMappedCount: stats.countyMappedZctas.size,
      countyCount: stats.countyFips.size,
      ecoregionMappedCount: stats.ecoregionMappedZctas.size,
      catalogMappedCount: stats.catalogMappedZctas.size,
      catalogCoverage: catalogStatus,
      localRangeEvidenceZctaCount: stats.localRangeEvidenceZctas.size,
      affirmativeRangeEvidenceZctaCount: stats.affirmativeRangeEvidenceZctas.size,
      notNativeEvidenceZctaCount: stats.notNativeEvidenceZctas.size,
      countyMetadataGapZctaCount: stats.countyMetadataGapZctas.size,
      gaps: {
        countyMapping: stats.zctas.size - stats.countyMappedZctas.size,
        countyMetadata: stats.countyMetadataGapZctas.size,
        ecoregionMapping: stats.zctas.size - stats.ecoregionMappedZctas.size,
        candidateCatalog: stats.zctas.size - stats.catalogMappedZctas.size,
        localRangeEvidence:
          stats.catalogMappedZctas.size - stats.localRangeEvidenceZctas.size,
      },
    };
  });

  const noCatalogStates = states.filter((state) => state.catalogCoverage === "none");
  const partialCatalogStates = states.filter((state) => state.catalogCoverage === "partial");
  const fullCatalogStates = states.filter((state) => state.catalogCoverage === "full");

  return {
    geography: {
      lower48StateCount: states.length,
      lower48ZctaCount: lower48Zctas.size,
      primaryCountyNameResolvedZctaCount: primaryCountyNameResolvedZctas.size,
      countyMappedZctaCount: countyMappedZctas.size,
      countyMappingGapCount: lower48Zctas.size - countyMappedZctas.size,
      countyMetadataGapZctaCount: countyMetadataGapZctas.size,
      countyMetadataGapsByFips: [...countyMetadataGapsByFips.values()].sort(
        (a, b) => a.countyFips.localeCompare(b.countyFips),
      ),
      unresolvedCountyStateZctaCount,
      ecoregionMappedZctaCount: ecoregionMappedZctas.size,
      zctasWithoutEcoregion: lower48Zctas.size - ecoregionMappedZctas.size,
      nonLower48ZctaCount,
    },
    catalog: {
      mappedZctaCount: catalogMappedZctas.size,
      mappedZctaCountWithResolvedPrimaryCountyMetadata:
        catalogMappedZctasWithResolvedPrimaryCounty.size,
      mappedZctaCountWithCountyMetadataGaps:
        catalogMappedZctas.size - catalogMappedZctasWithResolvedPrimaryCounty.size,
      unmappedZctaCount: lower48Zctas.size - catalogMappedZctas.size,
      statesWithNoCatalog: noCatalogStates.map((state) => state.state),
      statesWithPartialCatalog: partialCatalogStates.map((state) => state.state),
      statesWithFullCatalog: fullCatalogStates.map((state) => state.state),
    },
    localRangeEvidence: {
      recordCount: rangeEvidence.length,
      unresolvedCountyFipsRecordCount,
      catalogMappedZctasWithAnyCountyEvidence: localRangeEvidenceZctas.size,
      catalogMappedZctasWithAffirmativeEvidence: affirmativeRangeEvidenceZctas.size,
      catalogMappedZctasWithNotNativeEvidence: notNativeEvidenceZctas.size,
      catalogMappedZctasWithoutLocalEvidence:
        catalogMappedZctas.size - localRangeEvidenceZctas.size,
    },
    sourceEvidence: summarizeNativeSourceEvidence(sources, rangeEvidence, LOWER48),
    sources: Object.entries(sources).map(([id, source]) => ({
      id,
      authority: source.authority,
      name: source.name,
      citation: source.citation,
      url: source.url,
      releaseOrObservationDate: source.releaseOrObservationDate,
      retrievedAt: source.retrievedAt,
      licenseNote: source.licenseNote,
      geographicScope: source.geographicScope,
      spatialResolution: source.spatialResolution,
      coverage: source.coverage,
      uncertainty: source.uncertainty,
      rangeEvidenceAvailable: source.rangeEvidenceAvailable,
      ownerAuthorizationNote: source.ownerAuthorizationNote ?? null,
      sourceTermsStatus: source.sourceTermsStatus ?? "unknown",
      sourceCheckDate: source.sourceCheckDate ?? null,
      sourceStatusCategories: source.sourceStatusCategories ?? null,
    })),
    states,
  };
}

function readData(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function main() {
  const report = buildNativeCoverageReport({
    countyData: readData("data/natives/zip-county.json"),
    ecoregionData: readData("data/natives/zip-ecoregion.json"),
    ecoregionPlants: readData("data/natives/ecoregion-plants.json"),
    plants: readData("data/natives/plants.json").plants,
    sources: readData("data/natives/native-sources.json").sources,
    rangeEvidence: readData("data/natives/plant-range-evidence.json").records,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
