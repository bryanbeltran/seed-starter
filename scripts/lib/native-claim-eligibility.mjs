import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeScientificName } from "./native-taxonomy.mjs";

const BONAP_MAP_KEY_URL = "http://bonap.org/MapKey.html";
const BONAP_CATEGORIES = new Set([
  "Native",
  "Native Historic",
  "Adventive",
  "Exotic",
]);
const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const canonicalCountyFips = new Set(
  Object.keys(JSON.parse(fs.readFileSync(path.join(repositoryRoot, "data/natives/zip-county.json"), "utf8")).counties ?? {}),
);

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isUsdaClaim(record, source) {
  const url = parseUrl(record.sourceUrl);
  return Boolean(
    source?.authority === "USDA PLANTS" &&
      source.rangeEvidenceAvailable &&
      source.licenseNote?.trim() &&
      url?.protocol === "https:" &&
      (url.hostname === "usda.gov" || url.hostname.endsWith(".usda.gov")) &&
      record.sourceCitation?.toUpperCase().includes("USDA"),
  );
}

function bonapConversionForRecord(record, reviewRecords) {
  const claimReview = record.bonapReview;
  if (!canonicalCountyFips.has(record.countyFips ?? "")) return null;
  const conversions = [];
  for (const review of reviewRecords ?? []) {
    if (
      review?.plantId !== record.plantId ||
      review?.mapUrl !== record.sourceUrl ||
      review?.mapSha256 !== claimReview?.mapSha256
    ) continue;
    for (const county of review.counties ?? []) {
      if (county?.countyFips === record.countyFips) conversions.push({ review, county });
    }
  }
  if (conversions.length !== 1) return null;
  return conversions[0];
}

function mapTaxonName(mapUrl) {
  const url = parseUrl(mapUrl);
  const prefix = "/MapGallery/County/";
  if (
    url?.protocol !== "https:" ||
    url.hostname !== "bonap.net" ||
    !url.pathname.startsWith(prefix) ||
    !url.pathname.toLowerCase().endsWith(".png")
  ) return null;
  try {
    return decodeURIComponent(url.pathname.slice(prefix.length, -4));
  } catch {
    return null;
  }
}

function approvedBonapConversionForRecord(record, reviewRecords) {
  const claimReview = record.bonapReview;
  const conversion = bonapConversionForRecord(record, reviewRecords);
  if (!conversion) return false;
  const { review, county } = conversion;
  const linkedTaxonName = mapTaxonName(record.sourceUrl);
  return Boolean(
    review.reviewStatus === "approved" &&
      review.currentStatusConfirmed === true &&
      review.mapSha256 === claimReview.mapSha256 &&
      county.rawCategory === claimReview.rawCategory &&
      review.taxonomyMatch === claimReview.taxonomyMatch &&
      review.mapScopeDecision === claimReview.mapScopeDecision &&
      review.reviewStatus === claimReview.reviewStatus &&
      review.currentStatusConfirmed === claimReview.currentStatusConfirmed &&
      review.reviewer === claimReview.reviewer &&
      review.reviewedAt === claimReview.reviewedAt &&
      (review.reviewNote ?? null) === claimReview.reviewNote &&
      linkedTaxonName !== null &&
      normalizeScientificName(review.scientificName) === normalizeScientificName(linkedTaxonName),
  );
}

function bonapProvenanceMatches(record, snapshot, conversion) {
  if (!snapshot || !conversion) return false;
  const { review } = conversion;
  const claimReview = record.bonapReview;
  const snapshotGenerationDate = snapshot.mapGenerationDate ?? null;
  const reviewedGenerationDate = review.mapGenerationDateFromContent ?? null;
  const datesAgree =
    reviewedGenerationDate === null ||
    snapshotGenerationDate === null ||
    reviewedGenerationDate === snapshotGenerationDate;
  const expectedGenerationDate = reviewedGenerationDate ?? snapshotGenerationDate;
  const expectedGenerationDateSource = reviewedGenerationDate !== null
    ? "visual_map_content"
    : snapshot.mapGenerationDateSource ?? null;
  const snapshotGenerationMetadataIsValid = snapshotGenerationDate === null
    ? (snapshot.mapGenerationDateSource ?? null) === null
    : snapshot.mapGenerationDateSource === "png_content_metadata";
  return Boolean(
    datesAgree &&
      snapshotGenerationMetadataIsValid &&
      typeof snapshot.retrievedAt === "string" &&
      !Number.isNaN(Date.parse(snapshot.retrievedAt)) &&
      record.retrievedAt === snapshot.retrievedAt &&
      claimReview.mapGenerationDate === expectedGenerationDate &&
      claimReview.mapGenerationDateSource === expectedGenerationDateSource &&
      record.releaseOrObservationDate === expectedGenerationDate &&
      claimReview.etag === snapshot.etag &&
      claimReview.lastModified === snapshot.lastModified,
  );
}

function isBonapClaim(record, source, mapSnapshots, bonapReviewRecords) {
  const url = parseUrl(record.sourceUrl);
  const review = record.bonapReview;
  const mapScopeConfirmed = review?.mapScopeDecision === "confirmed_taxon_scope";
  const expectedNativity = !mapScopeConfirmed
    ? "unknown"
    : review?.rawCategory === "Native"
      ? "native"
      : BONAP_CATEGORIES.has(review?.rawCategory ?? "")
        ? "not_native"
        : "unknown";
  const conversion = bonapConversionForRecord(record, bonapReviewRecords);
  const matchingSnapshots = (mapSnapshots ?? []).filter((snapshot) =>
    snapshot?.sha256 === review?.mapSha256 &&
    snapshot?.mapUrl === record.sourceUrl &&
    snapshot?.mapKeyUrl === BONAP_MAP_KEY_URL
  );
  const snapshot = matchingSnapshots.length === 1 ? matchingSnapshots[0] : null;
  return Boolean(
    record.sourceId === "bonap-napa" &&
      source?.authority === "Biota of North America Program (BONAP)" &&
      source.rangeEvidenceAvailable &&
      source.sourceTermsStatus === "verified" &&
      source.ownerAuthorizationNote?.trim() &&
      source.licenseNote?.trim() &&
      url?.protocol === "https:" &&
      url.hostname === "bonap.net" &&
      /^\/MapGallery\/County\/[^/]+\.png$/i.test(url.pathname) &&
      record.sourceCitation?.toUpperCase().includes("BONAP") &&
      approvedBonapConversionForRecord(record, bonapReviewRecords) &&
      review?.reviewStatus === "approved" &&
      review.taxonomyMatch === "exact" &&
      ["confirmed_taxon_scope", "may_conflate_infraspecific", "unresolved"].includes(review.mapScopeDecision) &&
      review.currentStatusConfirmed === true &&
      review.reviewer?.trim() &&
      review.reviewedAt &&
      !Number.isNaN(Date.parse(review.reviewedAt)) &&
      review.reviewNote?.trim() &&
      /^[a-f0-9]{64}$/.test(review.mapSha256 ?? "") &&
      review.mapKeyUrl === BONAP_MAP_KEY_URL &&
      matchingSnapshots.length === 1 &&
      bonapProvenanceMatches(record, snapshot, conversion) &&
      typeof review.rawCategory === "string" &&
      review.rawCategory.trim().length > 0 &&
      record.nativityStatus === expectedNativity,
  );
}

/** Validate a source's reviewed support for a whole Census 2010 ZCTA unit. */
export function isEligibleFinerRangeEvidenceRecord(record, sources) {
  if (
    !record ||
    record.spatialResolution !== "finer" ||
    record.countyFips !== null ||
    record.finerArea?.geography !== "census-zcta-2010" ||
    !/^\d{5}$/.test(record.finerArea.zctaId ?? "")
  ) {
    return false;
  }

  const source = sources?.[record.sourceId];
  const sourceUrl = parseUrl(record.sourceUrl);
  const registryUrl = parseUrl(source?.url);
  return Boolean(
    source?.authority &&
      record.sourceId !== "usda-plants" &&
      source.authority !== "USDA PLANTS" &&
      record.sourceId !== "bonap-napa" &&
      source.rangeEvidenceAvailable &&
      source.sourceTermsStatus === "verified" &&
      source.licenseNote?.trim() &&
      record.licenseNote?.trim() &&
      source.verifiedFinerAreaGeographies?.includes(record.finerArea.geography) &&
      sourceUrl?.protocol === "https:" &&
      registryUrl?.protocol === "https:" &&
      sourceUrl.hostname === registryUrl.hostname &&
      record.sourceCitation?.toUpperCase().includes(source.authority.toUpperCase()),
  );
}

/** Source and provenance gate shared by ETL validation and offline coverage. */
export function isEligibleRangeEvidenceClaim(
  record,
  sources,
  mapSnapshots = [],
  requestedZctaId = null,
  bonapReviewRecords = [],
) {
  if (!record) return false;
  if (record.spatialResolution === "finer") {
    return (
      /^\d{5}$/.test(requestedZctaId ?? "") &&
      record.finerArea?.zctaId === requestedZctaId &&
      isEligibleFinerRangeEvidenceRecord(record, sources)
    );
  }
  if (record.spatialResolution !== "county" || !/^\d{5}$/.test(record.countyFips ?? "")) return false;
  const source = sources[record.sourceId];
  if (record.sourceId === "usda-plants") return isUsdaClaim(record, source);
  if (record.sourceId === "bonap-napa") {
    return isBonapClaim(record, source, mapSnapshots, bonapReviewRecords);
  }
  return false;
}

export function isAffirmativeRangeClaims(
  claims,
  sources,
  mapSnapshots = [],
  requestedZctaId = null,
  bonapReviewRecords = [],
) {
  return (
    claims.length > 0 &&
    claims.every(
      (claim) =>
        isEligibleRangeEvidenceClaim(claim, sources, mapSnapshots, requestedZctaId, bonapReviewRecords) &&
        claim.licenseNote?.trim() &&
        sources[claim.sourceId]?.licenseNote?.trim() &&
        claim.nativityStatus === "native",
    )
  );
}

export function isNotNativeRangeClaims(
  claims,
  sources,
  mapSnapshots = [],
  requestedZctaId = null,
  bonapReviewRecords = [],
) {
  return (
    claims.length > 0 &&
    claims.every(
      (claim) =>
        isEligibleRangeEvidenceClaim(claim, sources, mapSnapshots, requestedZctaId, bonapReviewRecords) &&
        claim.licenseNote?.trim() &&
        sources[claim.sourceId]?.licenseNote?.trim() &&
        claim.nativityStatus === "not_native",
    )
  );
}
