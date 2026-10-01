import type { NativeRangeEvidence, NativeSource } from "./schema";

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
  unknownCount: number;
  missingCount: number;
};

function isUsdaClaim(
  evidence: NativeRangeEvidence,
  sources: Record<string, NativeSource>,
): boolean {
  const source = sources[evidence.sourceId];
  const sourceUrl = new URL(evidence.sourceUrl);
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

function countyClaimsForPlant(
  plantId: string,
  countyFips: string,
  evidence: NativeRangeEvidence[],
  sources: Record<string, NativeSource>,
) {
  return evidence.filter(
    (record) =>
      record.plantId === plantId &&
      record.countyFips === countyFips &&
      isUsdaClaim(record, sources),
  );
}

function normalizedCountyFips(countyFips: string | string[] | null): string[] {
  if (Array.isArray(countyFips)) return [...new Set(countyFips.filter(Boolean))];
  return countyFips ? [countyFips] : [];
}

function affirmativeClaimsForCounty(claims: NativeRangeEvidence[]): boolean {
  return (
    claims.length > 0 &&
    claims.every(
      (claim) =>
        (claim.spatialResolution === "county" ||
          claim.spatialResolution === "finer") &&
        claim.nativityStatus === "native" &&
        Boolean(claim.licenseNote?.trim()),
    )
  );
}

function notNativeClaimsForCounty(claims: NativeRangeEvidence[]): boolean {
  return (
    claims.length > 0 &&
    claims.every(
      (claim) =>
        (claim.spatialResolution === "county" ||
          claim.spatialResolution === "finer") &&
        claim.nativityStatus === "not_native" &&
        Boolean(claim.licenseNote?.trim()),
    )
  );
}

/** Return only cited, affirmative USDA PLANTS county-or-finer claims for this county. */
export function affirmativeCountyEvidenceForPlant(
  plantId: string,
  countyFips: string | string[] | null,
  evidence: NativeRangeEvidence[],
  sources: Record<string, NativeSource>,
): NativeRangeEvidence[] {
  return normalizedCountyFips(countyFips).flatMap((fips) => {
    const claims = countyClaimsForPlant(plantId, fips, evidence, sources);
    if (
      !affirmativeClaimsForCounty(claims) ||
      claims.some((claim) => !sources[claim.sourceId]?.licenseNote?.trim())
    ) {
      return [];
    }
    return claims;
  });
}

export function summarizeNativeRangeEvidence(input: {
  candidateIds: string[];
  countyFips: string | string[] | null;
  geographyResolved: boolean;
  catalogAvailable: boolean;
  evidence: NativeRangeEvidence[];
  sources: Record<string, NativeSource>;
}): NativeRangeEvidenceSummary {
  const base = {
    catalogCandidateCount: input.candidateIds.length,
    affirmativeCount: 0,
    notNativeCount: 0,
    unknownCount: 0,
    missingCount: 0,
  };

  const countyFipses = normalizedCountyFips(input.countyFips);
  if (!input.geographyResolved || countyFipses.length === 0) {
    return { ...base, status: "unresolved_geography" };
  }
  if (!input.catalogAvailable) {
    return { ...base, status: "no_catalog" };
  }

  for (const plantId of input.candidateIds) {
    const claimsByCounty = countyFipses.map((fips) =>
      countyClaimsForPlant(plantId, fips, input.evidence, input.sources),
    );
    const claims = claimsByCounty.flat();
    if (claims.length === 0) {
      base.missingCount++;
      continue;
    }

    const countyIsAffirmative = claimsByCounty.some(
      (countyClaims) =>
        affirmativeClaimsForCounty(countyClaims) &&
        countyClaims.every(
          (claim) => input.sources[claim.sourceId]?.licenseNote?.trim(),
        ),
    );
    if (countyIsAffirmative) {
      base.affirmativeCount++;
      continue;
    }

    const allCountiesNotNative = claimsByCounty.every(
      (countyClaims) =>
        notNativeClaimsForCounty(countyClaims) &&
        countyClaims.every(
          (claim) => input.sources[claim.sourceId]?.licenseNote?.trim(),
        ),
    );
    if (allCountiesNotNative) {
      base.notNativeCount++;
    } else {
      base.unknownCount++;
    }
  }

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
