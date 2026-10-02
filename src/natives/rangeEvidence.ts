import { isKnownCountyFips } from "./lookupCounty";
import type {
  BonapCountyMapReview,
  NativePlant,
  NativeRangeEvidence,
  NativeSource,
} from "./schema";

export type BonapMapSnapshotRef = {
  mapUrl: string;
  sha256: string;
  mapKeyUrl: string;
  retrievedAt: string;
  etag: string | null;
  lastModified: string | null;
  mapGenerationDate: string | null;
  mapGenerationDateSource: "png_content_metadata" | null;
};

export type NativeRangeEvidenceStatus =
  | "unresolved_geography"
  | "no_catalog"
  | "no_local_evidence"
  | "affirmative_evidence"
  | "not_native_evidence";

export type NativeRangeEvidenceSummary = {
  status: NativeRangeEvidenceStatus;
  catalogCandidateCount: number;
  affirmativeCount: number;
  notNativeCount: number;
  conflictCount: number;
  unknownCount: number;
  unknownCountyCount: number;
  missingCount: number;
  countyIntersectionCount: number;
  evidenceSourceIds: string[];
  affirmativeSourceIds: string[];
  notNativeSourceIds: string[];
};

function normalizeScientificName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[×✕]/g, " x ")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function bonapMapTaxonName(mapUrl: string): string | null {
  try {
    const url = new URL(mapUrl);
    const prefix = "/MapGallery/County/";
    if (
      url.protocol !== "https:" ||
      url.hostname !== "bonap.net" ||
      !url.pathname.startsWith(prefix) ||
      !url.pathname.toLowerCase().endsWith(".png")
    ) return null;
    return decodeURIComponent(url.pathname.slice(prefix.length, -4));
  } catch {
    return null;
  }
}

/** Keep only exact BONAP reviews whose linked map taxon agrees with the catalog. */
export function bonapReviewsMatchingCatalogTaxa(
  reviews: BonapCountyMapReview[],
  plants: Record<string, Pick<NativePlant, "scientificName">>,
): BonapCountyMapReview[] {
  return reviews.filter((review) => {
    const plant = plants[review.plantId];
    const mapTaxonName = bonapMapTaxonName(review.mapUrl);
    return Boolean(
      review.taxonomyMatch === "exact" &&
      plant &&
      mapTaxonName &&
      normalizeScientificName(review.scientificName) === normalizeScientificName(plant.scientificName) &&
      normalizeScientificName(mapTaxonName) === normalizeScientificName(review.scientificName),
    );
  });
}

function isUsdaClaim(
  evidence: NativeRangeEvidence,
  sources: Record<string, NativeSource>,
): boolean {
  const source = sources[evidence.sourceId];
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(evidence.sourceUrl);
  } catch {
    return false;
  }
  const hostname = sourceUrl.hostname;
  const sourceLinkIsUsda =
    sourceUrl.protocol === "https:" &&
    (hostname === "usda.gov" || hostname.endsWith(".usda.gov"));
  return (
    source?.authority === "USDA PLANTS" &&
    source.rangeEvidenceAvailable &&
    sourceLinkIsUsda &&
    evidence.sourceCitation.toUpperCase().includes("USDA")
  );
}

function isBonapClaim(
  evidence: NativeRangeEvidence,
  sources: Record<string, NativeSource>,
  currentMapSnapshots: BonapMapSnapshotRef[],
  currentBonapMapReviews: BonapCountyMapReview[],
): boolean {
  const source = sources[evidence.sourceId];
  const review = evidence.bonapReview;
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(evidence.sourceUrl);
  } catch {
    return false;
  }
  const nonNativeCategories = ["Native Historic", "Adventive", "Exotic"];
  const mapScopeConfirmed = review?.mapScopeDecision === "confirmed_taxon_scope";
  const expectedNativity = !mapScopeConfirmed
    ? "unknown"
    : review?.rawCategory === "Native"
      ? "native"
      : nonNativeCategories.includes(review?.rawCategory ?? "")
        ? "not_native"
        : "unknown";
  const approvedConversions = currentBonapMapReviews.flatMap((mapReview) => {
    if (
      mapReview.plantId !== evidence.plantId ||
      mapReview.mapUrl !== evidence.sourceUrl ||
      mapReview.mapSha256 !== review?.mapSha256
    ) return [];
    return mapReview.counties
      .filter((county) => county.countyFips === evidence.countyFips)
      .map((county) => ({ mapReview, county }));
  });
  const conversion = approvedConversions.length === 1 ? approvedConversions[0] : undefined;
  const mapReview = conversion?.mapReview;
  const county = conversion?.county;
  const mapTaxonName = bonapMapTaxonName(evidence.sourceUrl);
  const matchingSnapshots = currentMapSnapshots.filter(
    (snapshot) =>
      snapshot.sha256 === review?.mapSha256 &&
      snapshot.mapUrl === evidence.sourceUrl &&
      snapshot.mapKeyUrl === review?.mapKeyUrl,
  );
  const snapshot = matchingSnapshots.length === 1 ? matchingSnapshots[0] : undefined;
  const reviewGenerationDate = mapReview?.mapGenerationDateFromContent ?? null;
  const snapshotGenerationDate = snapshot?.mapGenerationDate ?? null;
  const generationDatesAgree =
    reviewGenerationDate === null ||
    snapshotGenerationDate === null ||
    reviewGenerationDate === snapshotGenerationDate;
  const expectedGenerationDate = reviewGenerationDate ?? snapshotGenerationDate;
  const expectedGenerationDateSource = reviewGenerationDate !== null
    ? "visual_map_content"
    : snapshot?.mapGenerationDateSource ?? null;
  const snapshotGenerationMetadataIsValid = snapshot !== undefined && (
    snapshot.mapGenerationDate === null
      ? snapshot.mapGenerationDateSource === null
      : snapshot.mapGenerationDateSource === "png_content_metadata"
  );
  const approvedConversionMatches = Boolean(conversion && mapReview && county && (() => {
    return (
      mapReview.reviewStatus === "approved" &&
      mapReview.currentStatusConfirmed &&
      mapReview.mapSha256 === review?.mapSha256 &&
      mapTaxonName !== null &&
      normalizeScientificName(mapReview.scientificName) === normalizeScientificName(mapTaxonName) &&
      county.rawCategory === review?.rawCategory &&
      mapReview.taxonomyMatch === review?.taxonomyMatch &&
      mapReview.mapScopeDecision === review?.mapScopeDecision &&
      mapReview.reviewStatus === review?.reviewStatus &&
      mapReview.currentStatusConfirmed === review?.currentStatusConfirmed &&
      mapReview.reviewer === review?.reviewer &&
      mapReview.reviewedAt === review?.reviewedAt &&
      mapReview.reviewNote === review?.reviewNote &&
      generationDatesAgree &&
      evidence.releaseOrObservationDate === expectedGenerationDate &&
      review?.mapGenerationDate === expectedGenerationDate &&
      review?.mapGenerationDateSource === expectedGenerationDateSource &&
      snapshotGenerationMetadataIsValid &&
      typeof snapshot?.retrievedAt === "string" &&
      !Number.isNaN(Date.parse(snapshot.retrievedAt)) &&
      evidence.retrievedAt === snapshot.retrievedAt &&
      review?.etag === snapshot.etag &&
      review?.lastModified === snapshot.lastModified
    );
  })());
  return (
    evidence.sourceId === "bonap-napa" &&
    source?.authority === "Biota of North America Program (BONAP)" &&
    source.rangeEvidenceAvailable &&
    source.sourceTermsStatus === "verified" &&
    Boolean(source.ownerAuthorizationNote?.trim()) &&
    Boolean(source.licenseNote?.trim()) &&
    sourceUrl.protocol === "https:" &&
    sourceUrl.hostname === "bonap.net" &&
    /^\/MapGallery\/County\/[^/]+\.png$/i.test(sourceUrl.pathname) &&
    evidence.sourceCitation.toUpperCase().includes("BONAP") &&
    evidence.countyFips !== null &&
    isKnownCountyFips(evidence.countyFips) &&
    approvedConversionMatches &&
    review !== undefined &&
    review.reviewStatus === "approved" &&
    review.taxonomyMatch === "exact" &&
    ["confirmed_taxon_scope", "may_conflate_infraspecific", "unresolved"].includes(review.mapScopeDecision) &&
    review.currentStatusConfirmed &&
    Boolean(review.reviewer?.trim()) &&
    Boolean(review.reviewedAt && !Number.isNaN(Date.parse(review.reviewedAt))) &&
    Boolean(review.reviewNote?.trim()) &&
    review.rawCategory.trim().length > 0 &&
    matchingSnapshots.length === 1 &&
    evidence.nativityStatus === expectedNativity
  );
}

function isVerifiedFinerClaim(
  evidence: NativeRangeEvidence,
  sources: Record<string, NativeSource>,
): boolean {
  const source = sources[evidence.sourceId];
  let sourceUrl: URL;
  let registryUrl: URL;
  try {
    sourceUrl = new URL(evidence.sourceUrl);
    registryUrl = new URL(source?.url ?? "");
  } catch {
    return false;
  }
  return (
    evidence.spatialResolution === "finer" &&
    evidence.countyFips === null &&
    evidence.finerArea?.geography === "census-zcta-2010" &&
    /^\d{5}$/.test(evidence.finerArea.zctaId) &&
    Boolean(source?.authority?.trim()) &&
    evidence.sourceId !== "usda-plants" &&
    source?.authority !== "USDA PLANTS" &&
    evidence.sourceId !== "bonap-napa" &&
    Boolean(source?.rangeEvidenceAvailable) &&
    source?.sourceTermsStatus === "verified" &&
    Boolean(source.licenseNote?.trim()) &&
    Boolean(evidence.licenseNote?.trim()) &&
    Boolean(source.verifiedFinerAreaGeographies?.includes("census-zcta-2010")) &&
    sourceUrl.protocol === "https:" &&
    registryUrl.protocol === "https:" &&
    sourceUrl.hostname === registryUrl.hostname &&
    evidence.sourceCitation.toUpperCase().includes(source.authority.toUpperCase())
  );
}

function isEligibleSourceClaim(
  evidence: NativeRangeEvidence,
  sources: Record<string, NativeSource>,
  currentMapSnapshots: BonapMapSnapshotRef[],
  targetZctaId: string | null = null,
  currentBonapMapReviews: BonapCountyMapReview[] = [],
): boolean {
  if (evidence.spatialResolution === "finer") {
    return (
      targetZctaId !== null &&
      evidence.finerArea?.zctaId === targetZctaId &&
      isVerifiedFinerClaim(evidence, sources)
    );
  }
  if (evidence.spatialResolution !== "county") return false;
  if (evidence.sourceId === "usda-plants") return isUsdaClaim(evidence, sources);
  if (evidence.sourceId === "bonap-napa") {
    return isBonapClaim(evidence, sources, currentMapSnapshots, currentBonapMapReviews);
  }
  return false;
}

function countyClaimsForPlant(
  plantId: string,
  countyFips: string,
  evidence: NativeRangeEvidence[],
  sources: Record<string, NativeSource>,
  currentMapSnapshots: BonapMapSnapshotRef[],
  currentBonapMapReviews: BonapCountyMapReview[],
) {
  return evidence.filter(
    (record) =>
      record.plantId === plantId &&
      record.countyFips === countyFips &&
      isEligibleSourceClaim(record, sources, currentMapSnapshots, null, currentBonapMapReviews),
  );
}

function finerClaimsForPlant(
  plantId: string,
  targetZctaId: string,
  evidence: NativeRangeEvidence[],
  sources: Record<string, NativeSource>,
): NativeRangeEvidence[] {
  return evidence.filter(
    (record) =>
      record.plantId === plantId &&
      record.spatialResolution === "finer" &&
      isEligibleSourceClaim(record, sources, [], targetZctaId),
  );
}

function countyClaimsForPlantAcrossIntersections(
  plantId: string,
  countyFipses: string[],
  evidence: NativeRangeEvidence[],
  sources: Record<string, NativeSource>,
  currentMapSnapshots: BonapMapSnapshotRef[],
  currentBonapMapReviews: BonapCountyMapReview[],
): NativeRangeEvidence[][] {
  return countyFipses.map((fips) =>
    countyClaimsForPlant(plantId, fips, evidence, sources, currentMapSnapshots, currentBonapMapReviews),
  );
}

function affirmativeFinerClaims(
  claims: NativeRangeEvidence[],
  sources: Record<string, NativeSource>,
): boolean {
  return (
    affirmativeClaimsForZcta(claims) &&
    claims.every((claim) =>
      Boolean(claim.licenseNote?.trim()) &&
      Boolean(sources[claim.sourceId]?.licenseNote?.trim()),
    )
  );
}

function normalizedCountyFips(countyFips: string | string[] | null): string[] {
  if (Array.isArray(countyFips)) return [...new Set(countyFips.filter(Boolean))];
  return countyFips ? [countyFips] : [];
}

function nativityClaimsOppose(
  left: NativeRangeEvidence["nativityStatus"],
  right: NativeRangeEvidence["nativityStatus"],
): boolean {
  return (
    (left === "native" && right === "not_native") ||
    (left === "not_native" && right === "native")
  );
}

function conflictingClaimsForCounty(
  claims: NativeRangeEvidence[],
): NativeRangeEvidence[] {
  const conflictingClaims = new Set<NativeRangeEvidence>();
  for (let leftIndex = 0; leftIndex < claims.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < claims.length; rightIndex++) {
      const left = claims[leftIndex];
      const right = claims[rightIndex];
      if (nativityClaimsOppose(left.nativityStatus, right.nativityStatus)) {
        conflictingClaims.add(left);
        conflictingClaims.add(right);
      }
    }
  }
  return claims.filter((claim) => conflictingClaims.has(claim));
}

function affirmativeClaimsForCounty(claims: NativeRangeEvidence[]): boolean {
  return (
    claims.length > 0 &&
    claims.every(
      (claim) =>
        claim.spatialResolution === "county" &&
        claim.nativityStatus === "native" &&
        Boolean(claim.licenseNote?.trim()),
    )
  );
}

function affirmativeClaimsForZcta(claims: NativeRangeEvidence[]): boolean {
  return claims.length > 0 && claims.every((claim) => claim.nativityStatus === "native");
}

function notNativeClaimsForZcta(claims: NativeRangeEvidence[]): boolean {
  return claims.length > 0 && claims.every((claim) => claim.nativityStatus === "not_native");
}

function notNativeFinerClaims(
  claims: NativeRangeEvidence[],
  sources: Record<string, NativeSource>,
): boolean {
  return (
    notNativeClaimsForZcta(claims) &&
    claims.every((claim) =>
      Boolean(claim.licenseNote?.trim()) &&
      Boolean(sources[claim.sourceId]?.licenseNote?.trim()),
    )
  );
}

function notNativeClaimsForCounty(claims: NativeRangeEvidence[]): boolean {
  return (
    claims.length > 0 &&
    claims.every(
      (claim) =>
        claim.spatialResolution === "county" &&
        claim.nativityStatus === "not_native" &&
        Boolean(claim.licenseNote?.trim()),
    )
  );
}

/** Require all counties unless reviewed finer evidence identifies the whole ZCTA. */
export function affirmativeCountyEvidenceForPlant(
  plantId: string,
  countyFips: string | string[] | null,
  evidence: NativeRangeEvidence[],
  sources: Record<string, NativeSource>,
  currentMapSnapshots: BonapMapSnapshotRef[] = [],
  targetZctaId: string | null = null,
  currentBonapMapReviews: BonapCountyMapReview[] = [],
): NativeRangeEvidence[] {
  const countyFipses = normalizedCountyFips(countyFips);
  if (targetZctaId && /^\d{5}$/.test(targetZctaId)) {
    const finerClaims = finerClaimsForPlant(plantId, targetZctaId, evidence, sources);
    if (finerClaims.length > 0) {
      // A verified whole-ZCTA claim has priority over broader county claims for this ZIP.
      return affirmativeFinerClaims(finerClaims, sources) ? finerClaims : [];
    }
  }
  if (countyFipses.length === 0) return [];
  const claimsByCounty = countyClaimsForPlantAcrossIntersections(
    plantId,
    countyFipses,
    evidence,
    sources,
    currentMapSnapshots,
    currentBonapMapReviews,
  );
  if (
    !claimsByCounty.every(
      (claims) =>
        affirmativeClaimsForCounty(claims) &&
        claims.every((claim) => sources[claim.sourceId]?.licenseNote?.trim()),
    )
  ) {
    return [];
  }
  return claimsByCounty.flat();
}

/** Keep both sides of eligible county and verified whole-ZCTA disagreements visible. */
export function conflictingCountyEvidenceForPlant(
  plantId: string,
  countyFips: string | string[] | null,
  evidence: NativeRangeEvidence[],
  sources: Record<string, NativeSource>,
  currentMapSnapshots: BonapMapSnapshotRef[] = [],
  targetZctaId: string | null = null,
  currentBonapMapReviews: BonapCountyMapReview[] = [],
): NativeRangeEvidence[] {
  const claimsByCounty = countyClaimsForPlantAcrossIntersections(
    plantId,
    normalizedCountyFips(countyFips),
    evidence,
    sources,
    currentMapSnapshots,
    currentBonapMapReviews,
  );
  const sameCountyConflictClaims = claimsByCounty.flatMap(conflictingClaimsForCounty);
  if (!targetZctaId || !/^\d{5}$/.test(targetZctaId)) {
    return sameCountyConflictClaims;
  }

  const finerClaims = finerClaimsForPlant(plantId, targetZctaId, evidence, sources);
  const finerClaimsAreClassified =
    affirmativeFinerClaims(finerClaims, sources) ||
    notNativeFinerClaims(finerClaims, sources);
  if (!finerClaimsAreClassified) return sameCountyConflictClaims;

  const countyClaims = claimsByCounty.flat();
  const differingCountyClaims = countyClaims.filter(
    (claim) => nativityClaimsOppose(claim.nativityStatus, finerClaims[0].nativityStatus),
  );
  const finerConflictClaims = differingCountyClaims.length > 0
    ? [...finerClaims, ...differingCountyClaims]
    : [];
  return [...new Set([...sameCountyConflictClaims, ...finerConflictClaims])];
}

export function summarizeNativeRangeEvidence(input: {
  candidateIds: string[];
  countyFips: string | string[] | null;
  geographyResolved: boolean;
  catalogAvailable: boolean;
  evidence: NativeRangeEvidence[];
  sources: Record<string, NativeSource>;
  currentBonapMapSnapshots?: BonapMapSnapshotRef[];
  currentBonapMapReviews?: BonapCountyMapReview[];
  targetZctaId?: string | null;
}): NativeRangeEvidenceSummary {
  const countyFipses = normalizedCountyFips(input.countyFips);
  const base = {
    catalogCandidateCount: input.candidateIds.length,
    affirmativeCount: 0,
    notNativeCount: 0,
    conflictCount: 0,
    unknownCount: 0,
    unknownCountyCount: 0,
    missingCount: 0,
    countyIntersectionCount: countyFipses.length,
    evidenceSourceIds: [] as string[],
    affirmativeSourceIds: [] as string[],
    notNativeSourceIds: [] as string[],
  };

  const targetZctaResolved = /^\d{5}$/.test(input.targetZctaId ?? "");
  if (!input.geographyResolved && !targetZctaResolved) {
    return { ...base, status: "unresolved_geography" };
  }
  if (!input.catalogAvailable) {
    return { ...base, status: "no_catalog" };
  }

  const observedSources = new Set<string>();
  const affirmativeSources = new Set<string>();
  const notNativeSources = new Set<string>();
  for (const plantId of input.candidateIds) {
    const finerClaims = targetZctaResolved
      ? finerClaimsForPlant(plantId, input.targetZctaId!, input.evidence, input.sources)
      : [];
    const claimsByCounty = countyClaimsForPlantAcrossIntersections(
      plantId,
      countyFipses,
      input.evidence,
      input.sources,
      input.currentBonapMapSnapshots ?? [],
      input.currentBonapMapReviews ?? [],
    );
    const countyClaims = claimsByCounty.flat();
    const sameCountyConflictClaims = claimsByCounty.flatMap(conflictingClaimsForCounty);
    const claims = [...finerClaims, ...countyClaims];
    claims.forEach((claim) => observedSources.add(claim.sourceId));
    if (claims.length === 0) {
      base.missingCount++;
      continue;
    }

    const finerIsAffirmative = affirmativeFinerClaims(finerClaims, input.sources);
    const finerIsNotNative = notNativeFinerClaims(finerClaims, input.sources);
    const hasUnknownCountyClaim = countyClaims.some(
      (claim) => claim.nativityStatus === "unknown",
    );
    if (hasUnknownCountyClaim) base.unknownCountyCount++;
    const countyIsAffirmative = claimsByCounty.every(
      (countyClaims) =>
        countyClaims.length > 0 &&
        affirmativeClaimsForCounty(countyClaims) &&
        countyClaims.every(
          (claim) => input.sources[claim.sourceId]?.licenseNote?.trim(),
        ),
    );
    const finerCountyClaimsAreClassified =
      finerClaims.length > 0 &&
      (finerIsAffirmative || finerIsNotNative);
    const differingFinerCountyClaims = finerCountyClaimsAreClassified
      ? countyClaims.filter((claim) =>
          nativityClaimsOppose(claim.nativityStatus, finerClaims[0].nativityStatus),
        )
      : [];
    if (sameCountyConflictClaims.length > 0 || differingFinerCountyClaims.length > 0) {
      base.conflictCount++;
      for (const claim of [...sameCountyConflictClaims, ...differingFinerCountyClaims]) {
        if (claim.nativityStatus === "not_native") notNativeSources.add(claim.sourceId);
      }
    }

    if (finerClaims.length > 0 ? finerIsAffirmative : countyIsAffirmative) {
      base.affirmativeCount++;
      (finerClaims.length > 0 ? finerClaims : countyClaims)
        .forEach((claim) => affirmativeSources.add(claim.sourceId));
      continue;
    }

    const allCountiesNotNative = finerClaims.length > 0
      ? finerIsNotNative
      : claimsByCounty.every(
          (countyClaims) =>
            notNativeClaimsForCounty(countyClaims) &&
            countyClaims.every(
              (claim) => input.sources[claim.sourceId]?.licenseNote?.trim(),
            ),
        );
    if (allCountiesNotNative) {
      base.notNativeCount++;
      (finerClaims.length > 0 ? finerClaims : countyClaims)
        .forEach((claim) => notNativeSources.add(claim.sourceId));
    } else {
      base.unknownCount++;
    }
  }
  base.evidenceSourceIds = [...observedSources].sort();
  base.affirmativeSourceIds = [...affirmativeSources].sort();
  base.notNativeSourceIds = [...notNativeSources].sort();

  let status: NativeRangeEvidenceStatus = "no_local_evidence";
  if (base.affirmativeCount > 0) status = "affirmative_evidence";
  else if (
    base.catalogCandidateCount > 0 &&
    base.notNativeCount === base.catalogCandidateCount
  ) {
    status = "not_native_evidence";
  }
  return { ...base, status };
}
