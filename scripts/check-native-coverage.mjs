#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeNativeSourceEvidence } from "./lib/native-source-evidence.mjs";
import {
  isAffirmativeRangeClaims,
  isEligibleRangeEvidenceClaim,
  isNotNativeRangeClaims,
} from "./lib/native-claim-eligibility.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const BASELINE = Object.freeze({
  measuredAt: "2026-10-01",
  lower48ZctasWithCountyIntersections: 32_604,
  lower48ZctasWithEcoregion: 32_537,
  catalogMappedZctas: 3_168,
  catalogStatesWithNoCoverage: 28,
  catalogStatesWithPartialCoverage: 20,
  catalogStatesWithFullCoverage: 0,
  rangeEvidenceRecords: 0,
  zctasWithCompleteAffirmativeNativityCoverage: 0,
});

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
  const byPlantAndZcta = new Map();
  let unresolvedCountyFipsRecordCount = 0;
  for (const record of records) {
    if (record.countyFips === null && record.spatialResolution !== "finer") {
      unresolvedCountyFipsRecordCount++;
    }
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

    const zctaId = record.finerArea?.zctaId;
    if (record.spatialResolution === "finer" && /^\d{5}$/.test(zctaId ?? "")) {
      let byZctaId = byPlantAndZcta.get(record.plantId);
      if (!byZctaId) {
        byZctaId = new Map();
        byPlantAndZcta.set(record.plantId, byZctaId);
      }
      let zctaClaims = byZctaId.get(zctaId);
      if (!zctaClaims) {
        zctaClaims = [];
        byZctaId.set(zctaId, zctaClaims);
      }
      zctaClaims.push(record);
    }
  }
  return { byPlantId, byPlantAndZcta, unresolvedCountyFipsRecordCount };
}

function validLocalClaims(
  plantId,
  countyFips,
  evidenceByPlantAndCounty,
  sources,
  mapSnapshots,
  bonapReviewRecords,
) {
  const claims = evidenceByPlantAndCounty.get(plantId)?.get(countyFips) ?? [];
  return claims.filter((record) => {
    return (
      record.plantId === plantId &&
      record.countyFips === countyFips &&
      isEligibleRangeEvidenceClaim(record, sources, mapSnapshots, null, bonapReviewRecords)
    );
  });
}

function validLocalZctaClaims(plantId, zctaId, evidenceByPlantAndZcta, sources, mapSnapshots) {
  const claims = evidenceByPlantAndZcta.get(plantId)?.get(zctaId) ?? [];
  return claims.filter((record) =>
    isEligibleRangeEvidenceClaim(record, sources, mapSnapshots, zctaId),
  );
}

function countyIntersectionsForZip(countyData, zip) {
  const intersections = countyData.intersections?.[zip];
  return Array.isArray(intersections) ? intersections : [];
}

function stateForIntersection(intersection, countyData, byFips, byCode) {
  if (intersection.stateFips) {
    return byFips.get(String(intersection.stateFips).padStart(2, "0"));
  }
  return byCode.get(countyData.counties?.[intersection.fips]?.state);
}

function sourceReadiness(sourceId, retrievedAt, refreshStatus) {
  const attempt = refreshStatus?.sources?.[sourceId];
  if (!refreshStatus) return retrievedAt ? "retrieved" : "not_refreshed";
  if (refreshStatus.status === "running") {
    if (attempt?.status === "retrieving") return "incomplete_attempt";
    if (attempt?.status === "staged") return "not_published_stale";
    if (attempt?.status === "not_started") return retrievedAt ? "not_attempted_stale" : "not_attempted";
  }
  if (refreshStatus.status === "failed") {
    if (attempt?.status === "failed") return retrievedAt ? "failed_stale" : "failed";
    if (attempt?.status === "not_published") return "not_published_stale";
    if (attempt?.status === "not_started") return retrievedAt ? "not_attempted_stale" : "not_attempted";
    if (attempt?.status === "retrieving") return "incomplete_attempt";
  }
  if (refreshStatus.status === "succeeded") return "retrieved";
  if (refreshStatus.status === "validated") return retrievedAt ? "validated" : "not_published";
  return retrievedAt ? "retrieved" : "not_refreshed";
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

function summarizeSupplementalSourceIngestion(sourceIngestion, bonapMapReviews, countyData, refreshStatus) {
  const bonap = sourceIngestion?.bonap;
  const npin = sourceIngestion?.npin;
  const lower48CountyFipsByState = new Map(LOWER48.map((state) => [state.fips, new Set()]));
  for (const intersection of Object.values(countyData.intersections ?? {}).flat()) {
    if (/^\d{5}$/.test(String(intersection.fips ?? ""))) {
      lower48CountyFipsByState.get(intersection.fips.slice(0, 2))?.add(intersection.fips);
    }
  }
  const queriedCountyFipsByState = new Map(LOWER48.map((state) => [state.fips, new Set()]));
  for (const occurrence of bonap?.countyOccurrences ?? []) {
    queriedCountyFipsByState.get(String(occurrence.countyFips ?? "").slice(0, 2))?.add(occurrence.countyFips);
  }

  const bonapTaxonMatches = bonap?.taxonMatches ?? [];
  const bonapMappings = bonap?.mapMappings ?? [];
  const bonapMapSnapshots = bonap?.mapSnapshots ?? [];
  const npinEnrichments = npin?.enrichments ?? [];
  const reviewRecords = bonapMapReviews?.records ?? [];
  const isCurrentReview = (review) => bonapMapSnapshots.some((map) =>
    map.sha256 === review.mapSha256 &&
    map.mapUrl === review.mapUrl &&
    map.mapKeyUrl === bonapMapReviews?.mapKeyUrl,
  );
  const currentReviewRecords = reviewRecords.filter(isCurrentReview);
  const staleReviewRecords = reviewRecords.filter((review) => !isCurrentReview(review));
  const categoryCounts = new Map();
  let conversionCount = 0;
  for (const review of currentReviewRecords) {
    for (const county of review.counties ?? []) {
      conversionCount++;
      const category = String(county.rawCategory ?? "");
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  return {
    baselineMeasuredAt: BASELINE.measuredAt,
    bonap: {
      status: sourceReadiness("bonap-napa", bonap?.retrievedAt, refreshStatus),
      retrievedAt: bonap?.retrievedAt ?? null,
      lastSuccessAt: refreshStatus?.sources?.["bonap-napa"]?.lastSuccessAt ?? bonap?.retrievedAt ?? null,
      lastAttemptStatus: refreshStatus?.sources?.["bonap-napa"]?.status ?? null,
      fullTaxonListTaxonCount: bonap?.fullTaxonList?.taxonCount ?? 0,
      exactCatalogTaxonMatchCount: bonapTaxonMatches.filter((row) => row.matchStatus === "exact").length,
      ambiguousCatalogTaxonMatchCount: bonapTaxonMatches.filter((row) => row.matchStatus === "ambiguous").length,
      unresolvedCatalogTaxonMatchCount: bonapTaxonMatches.filter((row) => row.matchStatus === "unresolved").length,
      tdcOccurrenceCountyCount: (bonap?.countyOccurrences ?? []).length,
      tdcOccurrenceTaxonCount: (bonap?.countyOccurrences ?? []).reduce((sum, row) => sum + (row.occurrenceTaxonCount ?? 0), 0),
      tdcSpeciesAndNothospeciesTaxonCount: (bonap?.countyOccurrences ?? []).reduce((sum, row) => sum + (row.speciesAndNothospeciesTaxonCount ?? 0), 0),
      tdcInfraspecificTaxonCount: (bonap?.countyOccurrences ?? []).reduce((sum, row) => sum + (row.infraspecificTaxonCount ?? 0), 0),
      tdcSpeciesAndNothospeciesReportedCount: (bonap?.countyOccurrences ?? []).reduce((sum, row) => sum + (row.reportedSpeciesAndNothospeciesCount ?? 0), 0),
      tdcSpeciesAndNothospeciesReportedCountyCount: (bonap?.countyOccurrences ?? []).filter((row) => Number.isSafeInteger(row.reportedSpeciesAndNothospeciesCount)).length,
      tdcOccurrencePagesFetched: (bonap?.countyOccurrences ?? []).reduce((sum, row) => sum + (row.pageCount ?? 0), 0),
      catalogTaxonPresenceRecordCount: (bonap?.countyOccurrences ?? []).reduce((sum, row) => sum + (row.candidateTaxa?.length ?? 0), 0),
      tdcFullTaxonListUpdateMarkers: {
        etag: bonap?.fullTaxonList?.etag ?? null,
        lastModified: bonap?.fullTaxonList?.lastModified ?? null,
        responseBytes: bonap?.fullTaxonList?.responseBytes ?? null,
        verifiedResponseBytes: bonap?.fullTaxonList?.verifiedResponseBytes ?? null,
        completenessCheck: bonap?.fullTaxonList?.completenessCheck ?? null,
        sha256: bonap?.fullTaxonList?.sha256 ?? null,
      },
      tdcCountyOccurrenceUpdateMarkerCoverage: {
        etagCountyCount: (bonap?.countyOccurrences ?? []).filter((row) => row.etag).length,
        lastModifiedCountyCount: (bonap?.countyOccurrences ?? []).filter((row) => row.lastModified).length,
      },
      tdcTaxonDetailsUpdateMarkerCoverage: {
        etagTaxonCount: (bonap?.taxonDetails ?? []).filter((row) => row.etag).length,
        lastModifiedTaxonCount: (bonap?.taxonDetails ?? []).filter((row) => row.lastModified).length,
      },
      taxonDetailsCount: (bonap?.taxonDetails ?? []).length,
      taxonDetailsWithCountyOccurrenceMapCount: (bonap?.taxonDetails ?? []).filter((row) => row.countyOccurrenceMapCount > 0).length,
      napaMapTaxonCount: bonapMapSnapshots.length,
      exactMapLinkCount: bonapMappings.filter((row) => row.mapStatus === "exact").length,
      unresolvedMapLinkCount: bonapMappings.filter((row) => row.mapStatus === "unresolved").length,
      ambiguousMapLinkCount: bonapMappings.filter((row) => row.mapStatus === "ambiguous").length,
      mapSnapshots: bonapMapSnapshots.map((map) => {
        const review = currentReviewRecords.find((row) => row.mapSha256 === map.sha256);
        const generationDate = review?.mapGenerationDateFromContent ?? map.mapGenerationDate ?? null;
        return {
          mapUrl: map.mapUrl,
          mapSha256: map.sha256,
          retrievedAt: map.retrievedAt,
          etag: map.etag ?? null,
          lastModified: map.lastModified ?? null,
          mapGenerationDate: generationDate,
          mapGenerationDateSource: review?.mapGenerationDateFromContent
            ? "visual_map_content"
            : map.mapGenerationDateSource ?? null,
          mapKeyUrl: map.mapKeyUrl,
          reviewStatus: review?.reviewStatus ?? "unreviewed",
          taxonomyMatch: review?.taxonomyMatch ?? null,
          mapScopeDecision: review?.mapScopeDecision ?? null,
          currentStatusConfirmed: review?.currentStatusConfirmed ?? false,
        };
      }),
      reviewedCountyConversionCount: conversionCount,
      mapScopeReviewCounts: {
        confirmedTaxonScopeCount: currentReviewRecords.filter((row) => row.mapScopeDecision === "confirmed_taxon_scope").length,
        mayConflateInfraspecificCount: currentReviewRecords.filter((row) => row.mapScopeDecision === "may_conflate_infraspecific").length,
        unresolvedScopeCount: currentReviewRecords.filter((row) => row.mapScopeDecision === "unresolved").length,
      },
      approvedReviewedMapCount: currentReviewRecords.filter((row) => row.reviewStatus === "approved" && row.taxonomyMatch === "exact" && row.mapScopeDecision === "confirmed_taxon_scope" && row.currentStatusConfirmed).length,
      staleReviewMapCount: new Set(staleReviewRecords.map((row) => row.mapSha256)).size,
      staleReviewedCountyConversionCount: staleReviewRecords.reduce((sum, row) => sum + (row.counties?.length ?? 0), 0),
      mapsAwaitingCountyReviewCount: bonapMapSnapshots.filter((map) => !currentReviewRecords.some((row) => row.mapSha256 === map.sha256)).length,
      observedRawCategoryCounts: [...categoryCounts].map(([category, count]) => ({ category, count })).sort((a, b) => a.category.localeCompare(b.category)),
      lower48StateCoverage: LOWER48.map((state) => ({
        stateCode: state.code,
        state: state.name,
        stateFips: state.fips,
        countyFipsCount: lower48CountyFipsByState.get(state.fips).size,
        tdcOccurrenceCountyFipsCount: queriedCountyFipsByState.get(state.fips).size,
      })),
    },
    npin: {
      status: sourceReadiness("npin", npin?.retrievedAt, refreshStatus),
      retrievedAt: npin?.retrievedAt ?? null,
      lastSuccessAt: refreshStatus?.sources?.npin?.lastSuccessAt ?? npin?.retrievedAt ?? null,
      lastAttemptStatus: refreshStatus?.sources?.npin?.status ?? null,
      autocompleteTaxonMatchCount: npinEnrichments.filter((row) => row.matchStatus === "exact").length,
      ambiguousTaxonMatchCount: npinEnrichments.filter((row) => row.matchStatus === "ambiguous").length,
      unresolvedTaxonMatchCount: npinEnrichments.filter((row) => row.matchStatus === "unresolved").length,
      availableProfileCount: npinEnrichments.filter((row) => row.profileStatus === "available").length,
      challengedProfileCount: npinEnrichments.filter((row) => row.profileStatus === "challenge").length,
      profileFieldEnrichmentCount: npinEnrichments.filter((row) => Object.keys(row.fields ?? {}).length > 0).length,
      autocompleteEtagCount: npinEnrichments.filter((row) => row.autocompleteEtag).length,
      autocompleteLastModifiedCount: npinEnrichments.filter((row) => row.autocompleteLastModified).length,
      profileEtagCount: npinEnrichments.filter((row) => row.profileEtag).length,
      profileLastModifiedCount: npinEnrichments.filter((row) => row.profileLastModified).length,
      nativityEvidenceRecordCount: 0,
    },
  };
}

export function buildNativeCoverageReport({
  countyData,
  ecoregionData,
  ecoregionPlants,
  zctaCatalog = { zctas: {} },
  plants,
  sources,
  rangeEvidence,
  sourceIngestion,
  bonapMapReviews = { records: [] },
  refreshStatus = null,
}) {
  const byFips = new Map(LOWER48.map((state) => [state.fips, state]));
  const byCode = new Map(LOWER48.map((state) => [state.code, state]));
  const {
    byPlantId: evidenceByPlantAndCounty,
    byPlantAndZcta: evidenceByPlantAndZcta,
    unresolvedCountyFipsRecordCount,
  } =
    indexRangeEvidence(rangeEvidence);
  const currentBonapMapSnapshots = sourceIngestion?.bonap?.mapSnapshots ?? [];
  const currentBonapReviewRecords = bonapMapReviews?.records ?? [];
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
        completeLocalEvidenceZctas: new Set(),
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
  const completeLocalEvidenceZctas = new Set();
  const missingLocalEvidencePairs = new Set();
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
    const zipEcoregionId = ecoregionData.zips[zip];
    const zctaCatalogEntry = zctaCatalog.zctas?.[zip];
    const zipCandidates = ((zctaCatalogEntry
      ? zctaCatalog.plantSets?.[zctaCatalogEntry.plantSetId] ?? []
      : null) ??
      (zipEcoregionId && ecoregionData.names[zipEcoregionId]
        ? ecoregionPlants.ecoregions[zipEcoregionId]?.plantIds ?? []
        : []))
      .filter((id) => plants[id]);
    let zipHasAffirmativeEvidence = false;
    let zipHasNotNativeEvidence = false;
    let zipHasCompleteLocalEvidence = false;
    const allZipIntersectionsResolved =
      intersections.length > 0 &&
      intersections.every((intersection) => {
        if (!/^\d{5}$/.test(String(intersection.fips ?? ""))) return false;
        return Boolean(stateForIntersection(intersection, countyData, byFips, byCode));
      });
    const targetZctaResolved =
      Object.hasOwn(countyData.zips ?? {}, zip) ||
      Object.hasOwn(countyData.intersections ?? {}, zip);
    if (zipCandidates.length > 0 && (allZipIntersectionsResolved || targetZctaResolved)) {
      const countyFipses = [...new Set(intersections.map((row) => row.fips))];
      const claimsByPlant = zipCandidates.map((plantId) => {
        const finerClaims = targetZctaResolved
          ? validLocalZctaClaims(plantId, zip, evidenceByPlantAndZcta, sources, currentBonapMapSnapshots)
          : [];
        return finerClaims.length > 0
          ? { finerClaims, claimsByCounty: [] }
          : {
              finerClaims: [],
              claimsByCounty: countyFipses.map((fips) =>
                validLocalClaims(
                  plantId,
                  fips,
                  evidenceByPlantAndCounty,
                  sources,
                  currentBonapMapSnapshots,
                  currentBonapReviewRecords,
                ),
            ),
          };
      });
      zipHasCompleteLocalEvidence = true;
      for (let candidateIndex = 0; candidateIndex < claimsByPlant.length; candidateIndex++) {
        const { finerClaims, claimsByCounty } = claimsByPlant[candidateIndex];
        if (finerClaims.length > 0) continue;
        if (claimsByCounty.length !== countyFipses.length || claimsByCounty.some((claims) => claims.length === 0)) {
          zipHasCompleteLocalEvidence = false;
        }
        for (let countyIndex = 0; countyIndex < countyFipses.length; countyIndex++) {
          if (claimsByCounty[countyIndex]?.length > 0) continue;
          missingLocalEvidencePairs.add(
            `${zip}|${zipCandidates[candidateIndex]}|${countyFipses[countyIndex]}`,
          );
        }
      }
      zipHasAffirmativeEvidence = claimsByPlant.some(({ finerClaims, claimsByCounty }) =>
        finerClaims.length > 0
          ? isAffirmativeRangeClaims(finerClaims, sources, currentBonapMapSnapshots, zip)
          : claimsByCounty.every((claims) =>
              isAffirmativeRangeClaims(claims, sources, currentBonapMapSnapshots, null, currentBonapReviewRecords),
            ),
      );
      zipHasNotNativeEvidence = claimsByPlant.some(({ finerClaims, claimsByCounty }) =>
        finerClaims.length > 0
          ? isNotNativeRangeClaims(finerClaims, sources, currentBonapMapSnapshots, zip)
          : claimsByCounty.every((claims) =>
              isNotNativeRangeClaims(claims, sources, currentBonapMapSnapshots, null, currentBonapReviewRecords),
            ),
      );
    }
    if (zipHasAffirmativeEvidence) affirmativeRangeEvidenceZctas.add(zip);
    if (zipHasNotNativeEvidence) notNativeEvidenceZctas.add(zip);
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
      if (ecoregionId && ecoregionData.names[ecoregionId]) {
        ecoregionMappedZctas.add(zip);
        stats.ecoregionMappedZctas.add(zip);
      }

      const knownCandidateIds = zipCandidates;
      if (knownCandidateIds.length === 0) continue;
      catalogMappedZctas.add(zip);
      stats.catalogMappedZctas.add(zip);
      if (primaryCounty?.name) {
        catalogMappedZctasWithResolvedPrimaryCounty.add(zip);
      }

      const localClaimsByPlant = knownCandidateIds.map((plantId) => {
        const finerClaims = validLocalZctaClaims(plantId, zip, evidenceByPlantAndZcta, sources, currentBonapMapSnapshots);
        const claimsByCounty = finerClaims.length > 0
          ? [finerClaims]
          : countyFipses.map((fips) =>
              validLocalClaims(
                plantId,
                fips,
                evidenceByPlantAndCounty,
                sources,
                currentBonapMapSnapshots,
                currentBonapReviewRecords,
              ),
            );
        return { claimsByCounty, claims: claimsByCounty.flat() };
      });
      const localClaims = localClaimsByPlant.flatMap((result) => result.claims);
      if (localClaims.length > 0) {
        localRangeEvidenceZctas.add(zip);
        stats.localRangeEvidenceZctas.add(zip);
      }
      if (zipHasAffirmativeEvidence) {
        stats.affirmativeRangeEvidenceZctas.add(zip);
      }
      if (zipHasCompleteLocalEvidence) {
        completeLocalEvidenceZctas.add(zip);
        stats.completeLocalEvidenceZctas.add(zip);
      }
      if (zipHasNotNativeEvidence) {
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
      completeLocalEvidenceZctaCount: stats.completeLocalEvidenceZctas.size,
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
        completeLocalRangeEvidence:
          stats.catalogMappedZctas.size - stats.completeLocalEvidenceZctas.size,
      },
    };
  });

  const noCatalogStates = states.filter((state) => state.catalogCoverage === "none");
  const partialCatalogStates = states.filter((state) => state.catalogCoverage === "partial");
  const fullCatalogStates = states.filter((state) => state.catalogCoverage === "full");
  const sourceAdapters = summarizeSupplementalSourceIngestion(
    sourceIngestion,
    bonapMapReviews,
    countyData,
    refreshStatus,
  );

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
      catalogMappedZctasWithCompleteLocalEvidence: completeLocalEvidenceZctas.size,
      catalogMappedZctasWithoutCompleteLocalEvidence:
        catalogMappedZctas.size - completeLocalEvidenceZctas.size,
      missingCandidateCountyEvidencePairCount: missingLocalEvidencePairs.size,
      catalogMappedZctasWithCompleteAffirmativeCoverage: affirmativeRangeEvidenceZctas.size,
      catalogMappedZctasWithAffirmativeEvidence: affirmativeRangeEvidenceZctas.size,
      catalogMappedZctasWithNotNativeEvidence: notNativeEvidenceZctas.size,
      catalogMappedZctasWithoutLocalEvidence:
        catalogMappedZctas.size - localRangeEvidenceZctas.size,
    },
    sourceDiscovery: sourceAdapters,
    refreshRun: refreshStatus,
    baselineComparison: {
      baseline: BASELINE,
      current: {
        lower48ZctasWithCountyIntersections: countyMappedZctas.size,
        lower48ZctasWithEcoregion: ecoregionMappedZctas.size,
        catalogMappedZctas: catalogMappedZctas.size,
        catalogStatesWithNoCoverage: noCatalogStates.length,
        catalogStatesWithPartialCoverage: partialCatalogStates.length,
        catalogStatesWithFullCoverage: fullCatalogStates.length,
        rangeEvidenceRecords: rangeEvidence.length,
        zctasWithCompleteAffirmativeNativityCoverage: affirmativeRangeEvidenceZctas.size,
        bonapFullTaxonListTaxonCount: sourceAdapters.bonap.fullTaxonListTaxonCount,
        bonapCountyMapSnapshotCount: sourceAdapters.bonap.napaMapTaxonCount,
        npinProfileEnrichmentCount: sourceAdapters.npin.profileFieldEnrichmentCount,
      },
      changeFromBaseline: {
        lower48ZctasWithCountyIntersections:
          countyMappedZctas.size - BASELINE.lower48ZctasWithCountyIntersections,
        lower48ZctasWithEcoregion: ecoregionMappedZctas.size - BASELINE.lower48ZctasWithEcoregion,
        catalogMappedZctas: catalogMappedZctas.size - BASELINE.catalogMappedZctas,
        catalogStatesWithNoCoverage: noCatalogStates.length - BASELINE.catalogStatesWithNoCoverage,
        catalogStatesWithPartialCoverage: partialCatalogStates.length - BASELINE.catalogStatesWithPartialCoverage,
        catalogStatesWithFullCoverage: fullCatalogStates.length - BASELINE.catalogStatesWithFullCoverage,
        rangeEvidenceRecords: rangeEvidence.length - BASELINE.rangeEvidenceRecords,
        zctasWithCompleteAffirmativeNativityCoverage:
          affirmativeRangeEvidenceZctas.size - BASELINE.zctasWithCompleteAffirmativeNativityCoverage,
        bonapTaxonDiscoveryHasComparableBaseline: false,
        npinEnrichmentHasComparableBaseline: false,
      },
      mappingCountsAreNotNativityCoverage: true,
    },
    sourceEvidence: summarizeNativeSourceEvidence(
      sources,
      rangeEvidence,
      LOWER48,
      currentBonapMapSnapshots,
      currentBonapReviewRecords,
    ),
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
      verifiedFinerAreaGeographies: source.verifiedFinerAreaGeographies ?? [],
    })),
    states,
  };
}

function readData(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function main() {
  const countyData = readData("data/natives/zip-county.json");
  const refreshStatusPath = process.env.NATIVE_SOURCE_REFRESH_STATUS_PATH ??
    path.join(root, "data/natives/native-source-refresh-status.json");
  const report = buildNativeCoverageReport({
    countyData,
    ecoregionData: readData("data/natives/zip-ecoregion.json"),
    ecoregionPlants: readData("data/natives/ecoregion-plants.json"),
    zctaCatalog: readData("data/natives/zcta-catalog.json"),
    plants: readData("data/natives/plants.json").plants,
    sources: readData("data/natives/native-sources.json").sources,
    rangeEvidence: readData("data/natives/plant-range-evidence.json").records,
    sourceIngestion: readData("data/natives/native-source-ingestion.json"),
    bonapMapReviews: readData("data/natives/bonap-county-map-reviews.json"),
    refreshStatus: fs.existsSync(refreshStatusPath)
      ? JSON.parse(fs.readFileSync(refreshStatusPath, "utf8"))
      : null,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
