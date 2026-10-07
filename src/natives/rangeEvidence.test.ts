import { describe, expect, it } from "vitest";
import {
  affirmativeCountyEvidenceForPlant,
  bonapReviewsMatchingCatalogTaxa,
  summarizeNativeRangeEvidence,
} from "./rangeEvidence";
import {
  nativeRangeEvidenceSchema,
  type BonapCountyMapReview,
  type NativeRangeEvidence,
  type NativeSource,
} from "./schema";

const source: NativeSource = {
  authority: "USDA PLANTS",
  name: "USDA PLANTS Database",
  citation: "USDA, NRCS. PLANTS Database. Date unavailable.",
  url: "https://plants.usda.gov",
  releaseOrObservationDate: null,
  retrievedAt: null,
  licenseNote: "PLANTS information is reusable with citation.",
  geographicScope: "United States; county record.",
  spatialResolution: "county",
  coverage: "County range data.",
  uncertainty: null,
  rangeEvidenceAvailable: true,
};

const bonapSource: NativeSource = {
  ...source,
  authority: "Biota of North America Program (BONAP)",
  name: "BONAP NAPA",
  citation: "BONAP. North American Plant Atlas.",
  url: "https://bonap.net/Napa/TaxonMaps/Genus/County/Echinacea",
  licenseNote: "BONAP facts may be reproduced with permission and citation.",
  sourceTermsStatus: "verified",
  ownerAuthorizationNote: "The owner confirms written permission to bundle BONAP data.",
};

function approvedMapReviewFor(record: NativeRangeEvidence): BonapCountyMapReview {
  const review = record.bonapReview!;
  return {
    plantId: record.plantId,
    scientificName: "Echinacea purpurea",
    mapUrl: record.sourceUrl,
    mapSha256: review.mapSha256,
    mapGenerationDateFromContent: review.mapGenerationDate,
    taxonomyMatch: review.taxonomyMatch,
    mapScopeDecision: review.mapScopeDecision,
    reviewStatus: "approved",
    currentStatusConfirmed: true,
    reviewer: review.reviewer,
    reviewedAt: review.reviewedAt,
    reviewNote: review.reviewNote ?? "Reviewed against image and MapKey.",
    counties: [{ countyFips: record.countyFips!, rawCategory: review.rawCategory }],
  };
}

function record(
  overrides: Partial<NativeRangeEvidence> = {},
): NativeRangeEvidence {
  return nativeRangeEvidenceSchema.parse({
    plantId: "plant-a",
    sourceId: "usda-plants",
    sourceCitation: "USDA, NRCS. PLANTS Database. Date unavailable.",
    sourceUrl: "https://plants.usda.gov/plant-profile?symbol=PLANTA",
    releaseOrObservationDate: null,
    retrievedAt: null,
    licenseNote: "PLANTS information is reusable with citation.",
    geographicScope: "County FIPS 27053.",
    spatialResolution: "county",
    countyFips: "27053",
    nativityStatus: "native",
    uncertainty: null,
    ...overrides,
  });
}

describe("affirmativeCountyEvidenceForPlant", () => {
  it("requires a whole-ZCTA identifier for finer evidence", () => {
    const validFinerRecord = record({
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55401" },
    });
    expect(nativeRangeEvidenceSchema.safeParse(validFinerRecord).success).toBe(true);
    expect(nativeRangeEvidenceSchema.safeParse({
      ...record(),
      spatialResolution: "finer",
    }).success).toBe(false);
  });

  it("matches county-wide USDA PLANTS evidence only at the resolved county", () => {
    const claim = record();
    expect(
      affirmativeCountyEvidenceForPlant(
        "plant-a",
        "27053",
        [claim],
        { "usda-plants": source },
      ),
    ).toEqual([claim]);
    expect(
      affirmativeCountyEvidenceForPlant(
        "plant-a",
        "27055",
        [claim],
        { "usda-plants": source },
      ),
    ).toEqual([]);

    const finerClaim = record({
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55401" },
    });
    expect(
      affirmativeCountyEvidenceForPlant(
        "plant-a",
        "27053",
        [finerClaim],
        { "usda-plants": source },
      ),
    ).toEqual([]);
  });

  it.each([
    ["non-native", { nativityStatus: "not_native" as const }],
    ["unknown nativity", { nativityStatus: "unknown" as const }],
    ["unknown resolution", { spatialResolution: "unknown" as const }],
    ["unknown license", { licenseNote: null }],
  ])("rejects %s evidence", (_label, overrides) => {
    expect(
      affirmativeCountyEvidenceForPlant(
        "plant-a",
        "27053",
        [record(overrides)],
        { "usda-plants": source },
      ),
    ).toEqual([]);
  });

  it("rejects evidence from other sources or a source without range coverage", () => {
    const claim = record();
    expect(
      affirmativeCountyEvidenceForPlant("plant-a", "27053", [claim], {
        "usda-plants": { ...source, authority: "EPA Level III" },
      }),
    ).toEqual([]);
    expect(
      affirmativeCountyEvidenceForPlant("plant-a", "27053", [claim], {
        "usda-plants": { ...source, rangeEvidenceAvailable: false },
      }),
    ).toEqual([]);
  });

  it("requires the cited range record link to be on an official USDA domain", () => {
    expect(
      affirmativeCountyEvidenceForPlant(
        "plant-a",
        "27053",
        [record({ sourceUrl: "https://example.org/range.csv" })],
        { "usda-plants": source },
      ),
    ).toEqual([]);
    expect(
      affirmativeCountyEvidenceForPlant(
        "plant-a",
        "27053",
        [record({ sourceUrl: "http://plants.usda.gov/plant-profile" })],
        { "usda-plants": source },
      ),
    ).toEqual([]);
  });

  it("counts an unknown source license as unknown evidence and never recommends it", () => {
    const claim = record();
    const unknownLicenseSource = { ...source, licenseNote: null };
    expect(
      affirmativeCountyEvidenceForPlant("plant-a", "27053", [claim], {
        "usda-plants": unknownLicenseSource,
      }),
    ).toEqual([]);
    expect(
      summarizeNativeRangeEvidence({
        candidateIds: ["plant-a"],
        countyFips: "27053",
        geographyResolved: true,
        catalogAvailable: true,
        evidence: [claim],
        sources: { "usda-plants": unknownLicenseSource },
      }),
    ).toMatchObject({
      status: "no_local_evidence",
      affirmativeCount: 0,
      unknownCount: 1,
      missingCount: 0,
    });
  });

  it("rejects conflicting positive and negative claims", () => {
    expect(
      affirmativeCountyEvidenceForPlant(
        "plant-a",
        "27053",
        [record(), record({ nativityStatus: "not_native" })],
        { "usda-plants": source },
      ),
    ).toEqual([]);
  });
});

describe("summarizeNativeRangeEvidence", () => {
  const base = {
    candidateIds: ["plant-a", "plant-b"],
    countyFips: "27053",
    geographyResolved: true,
    catalogAvailable: true,
    sources: { "usda-plants": source },
  };

  it("distinguishes unresolved geography and an absent catalog", () => {
    expect(
      summarizeNativeRangeEvidence({ ...base, geographyResolved: false, evidence: [] })
        .status,
    ).toBe("unresolved_geography");
    expect(
      summarizeNativeRangeEvidence({ ...base, catalogAvailable: false, evidence: [] })
        .status,
    ).toBe("no_catalog");
  });

  it("reports missing evidence without calling candidates non-native", () => {
    expect(
      summarizeNativeRangeEvidence({ ...base, evidence: [] }),
    ).toEqual({
      status: "no_local_evidence",
      catalogCandidateCount: 2,
      affirmativeCount: 0,
      notNativeCount: 0,
      conflictCount: 0,
      unknownCount: 0,
      unknownCountyCount: 0,
      missingCount: 2,
      countyIntersectionCount: 1,
      evidenceSourceIds: [],
      affirmativeSourceIds: [],
      notNativeSourceIds: [],
    });
  });

  it("reports explicit non-native evidence separately from missing evidence", () => {
    const summary = summarizeNativeRangeEvidence({
      ...base,
      evidence: [record({ nativityStatus: "not_native" })],
    });
    expect(summary).toMatchObject({
      status: "no_local_evidence",
      notNativeCount: 1,
      missingCount: 1,
    });

    expect(
      summarizeNativeRangeEvidence({
        ...base,
        evidence: [
          record({ nativityStatus: "not_native" }),
          record({ plantId: "plant-b", nativityStatus: "not_native" }),
        ],
      }).status,
    ).toBe("not_native_evidence");
  });

  it("counts affirmative evidence only when all claims for that plant agree", () => {
    expect(
      summarizeNativeRangeEvidence({ ...base, evidence: [record()] }),
    ).toMatchObject({ status: "affirmative_evidence", affirmativeCount: 1 });
    expect(
      summarizeNativeRangeEvidence({
        ...base,
        evidence: [record(), record({ nativityStatus: "not_native" })],
      }),
    ).toMatchObject({
      status: "no_local_evidence",
      affirmativeCount: 0,
      unknownCount: 1,
    });
  });
});

describe("BONAP reviewed county claims", () => {
  const reviewedNativeRecord: NativeRangeEvidence = {
    ...record({
      sourceId: "bonap-napa",
      sourceCitation: "BONAP NAPA county map; raw county category Native.",
      sourceUrl: "https://bonap.net/MapGallery/County/Echinacea%20purpurea.png",
      releaseOrObservationDate: "2014-12-14",
      retrievedAt: "2026-10-01T12:00:00.000Z",
      licenseNote: "BONAP facts may be reproduced with permission and citation.",
      nativityStatus: "native",
    }),
    bonapReview: {
      mapSha256: "a".repeat(64),
      mapKeyUrl: "http://bonap.org/MapKey.html",
      mapGenerationDate: "2014-12-14",
      mapGenerationDateSource: "visual_map_content",
      etag: '"d5988b42bfd0d21:0"',
      lastModified: "Fri, 19 May 2017 00:00:00 GMT",
      rawCategory: "Native",
      taxonomyMatch: "exact",
      mapScopeDecision: "confirmed_taxon_scope",
      reviewStatus: "approved",
      currentStatusConfirmed: true,
      reviewer: "native-data-reviewer",
      reviewedAt: "2026-10-01T12:00:00.000Z",
      reviewNote: "Exact taxon and county category reviewed against this map hash and MapKey.",
    },
  };
  const currentMapSnapshots = [{
    mapUrl: reviewedNativeRecord.sourceUrl,
    sha256: reviewedNativeRecord.bonapReview!.mapSha256,
    mapKeyUrl: reviewedNativeRecord.bonapReview!.mapKeyUrl,
    retrievedAt: reviewedNativeRecord.retrievedAt!,
    etag: reviewedNativeRecord.bonapReview!.etag,
    lastModified: reviewedNativeRecord.bonapReview!.lastModified,
    mapGenerationDate: "2014-12-14",
    mapGenerationDateSource: "png_content_metadata" as const,
  }];
  const approvedReviews = [approvedMapReviewFor(reviewedNativeRecord)];

  it("admits only a reviewed exact current Native county category on a BONAP taxon map", () => {
    expect(
      affirmativeCountyEvidenceForPlant("plant-a", "27053", [reviewedNativeRecord], {
        "bonap-napa": bonapSource,
      }, currentMapSnapshots, null, approvedReviews),
    ).toEqual([reviewedNativeRecord]);
  });

  it("rejects an exact approved review when its map taxon belongs to another catalog plant", () => {
    const currentPlant = { "plant-a": { scientificName: "Echinacea purpurea" } };
    const wrongPlant = { "plant-a": { scientificName: "Echinacea angustifolia" } };
    expect(bonapReviewsMatchingCatalogTaxa(approvedReviews, currentPlant)).toEqual(approvedReviews);
    const mismatchedReviews = bonapReviewsMatchingCatalogTaxa(approvedReviews, wrongPlant);

    expect(mismatchedReviews).toEqual([]);
    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      "27053",
      [reviewedNativeRecord],
      { "bonap-napa": bonapSource },
      currentMapSnapshots,
      null,
      mismatchedReviews,
    )).toEqual([]);
  });

  it("requires BONAP claim geography and category to match an approved conversion row", () => {
    const wrongCounty = { ...reviewedNativeRecord, countyFips: "27123" };
    const invalidCounty = { ...reviewedNativeRecord, countyFips: "01000" };
    const wrongCategory = {
      ...reviewedNativeRecord,
      bonapReview: {
        ...reviewedNativeRecord.bonapReview!,
        rawCategory: "Native Historic",
      },
    };
    for (const claim of [wrongCounty, invalidCounty, wrongCategory]) {
      expect(affirmativeCountyEvidenceForPlant(
        "plant-a",
        claim.countyFips,
        [claim],
        { "bonap-napa": bonapSource },
        currentMapSnapshots,
        null,
        approvedReviews,
      )).toEqual([]);
    }
  });

  it.each([
    ["historic", { bonapReview: { ...reviewedNativeRecord.bonapReview!, rawCategory: "Native Historic" }, nativityStatus: "not_native" as const }],
    ["adventive", { bonapReview: { ...reviewedNativeRecord.bonapReview!, rawCategory: "Adventive" }, nativityStatus: "not_native" as const }],
    ["exotic", { bonapReview: { ...reviewedNativeRecord.bonapReview!, rawCategory: "Exotic" }, nativityStatus: "not_native" as const }],
    ["ambiguous taxonomy", { bonapReview: { ...reviewedNativeRecord.bonapReview!, taxonomyMatch: "ambiguous" as const } }],
    ["pending review", { bonapReview: { ...reviewedNativeRecord.bonapReview!, reviewStatus: "pending" as const } }],
    ["unconfirmed current status", { bonapReview: { ...reviewedNativeRecord.bonapReview!, currentStatusConfirmed: false } }],
    ["unapproved raw category", { bonapReview: { ...reviewedNativeRecord.bonapReview!, rawCategory: "rare" }, nativityStatus: "unknown" as const }],
    ["unofficial map path", { sourceUrl: "https://bonap.net/MapGallery/County/Genus/Echinacea.png" }],
  ])("does not affirm %s BONAP evidence", (_label, overrides) => {
    const claim = { ...reviewedNativeRecord, ...overrides };
    expect(
      affirmativeCountyEvidenceForPlant(
        "plant-a",
        "27053",
        [claim],
        { "bonap-napa": bonapSource },
        currentMapSnapshots,
        null,
        [approvedMapReviewFor(claim)],
      ),
    ).toEqual([]);
  });
});
