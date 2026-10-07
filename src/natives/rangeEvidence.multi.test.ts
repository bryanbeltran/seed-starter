import { describe, expect, it } from "vitest";
import type { BonapCountyMapReview, NativeRangeEvidence, NativeSource } from "./schema";
import {
  affirmativeCountyEvidenceForPlant,
  conflictingCountyEvidenceForPlant,
  summarizeNativeRangeEvidence,
} from "./rangeEvidence";

const source: NativeSource = {
  authority: "USDA PLANTS",
  name: "USDA PLANTS Database",
  citation: "USDA, NRCS. PLANTS Database.",
  url: "https://plants.usda.gov",
  releaseOrObservationDate: null,
  retrievedAt: null,
  licenseNote: "Reusable with citation.",
  geographicScope: "County or county-equivalent.",
  spatialResolution: "county",
  coverage: "County claims.",
  uncertainty: null,
  rangeEvidenceAvailable: true,
};

function record(overrides: Partial<NativeRangeEvidence> = {}): NativeRangeEvidence {
  return {
    plantId: "plant-a",
    sourceId: "usda-plants",
    sourceCitation: "USDA, NRCS. PLANTS County MapServer.",
    sourceUrl:
      "https://apps.geo.fpac.usda.gov/nrcs-geodata/rest/services/land_use_land_cover/plants/MapServer/6",
    releaseOrObservationDate: null,
    retrievedAt: "2026-10-01T12:00:00.000Z",
    licenseNote: "Reusable with citation.",
    geographicScope: "County FIPS 27053.",
    spatialResolution: "county",
    countyFips: "27053",
    nativityStatus: "native",
    uncertainty: null,
    ...overrides,
  };
}

const sources = { "usda-plants": source };
const finerSource: NativeSource = {
  ...source,
  authority: "Example Botanical Atlas",
  name: "Example Botanical Atlas",
  citation: "Example Botanical Atlas ZCTA data.",
  url: "https://flora.example/range-data",
  licenseNote: "Reuse with attribution.",
  sourceTermsStatus: "verified",
  verifiedFinerAreaGeographies: ["census-zcta-2010"],
};
const finerSources = { "example-atlas": finerSource };
const bonapSource: NativeSource = {
  ...source,
  authority: "Biota of North America Program (BONAP)",
  name: "BONAP North American Plant Atlas",
  citation: "BONAP North American Plant Atlas.",
  url: "https://bonap.net/Napa/TaxonMaps/Genus/County/Echinacea",
  rangeEvidenceAvailable: true,
  ownerAuthorizationNote: "Project owner confirms written permission.",
  sourceTermsStatus: "verified",
};
const bonapSources = { "bonap-napa": bonapSource };
const bonapMapUrl = "https://bonap.net/MapGallery/County/Echinacea%20purpurea.png";
const bonapMapSha256 = "a".repeat(64);

function approvedReviewFor(record: NativeRangeEvidence): BonapCountyMapReview {
  const review = record.bonapReview!;
  return {
    plantId: record.plantId,
    scientificName: "Echinacea purpurea",
    mapUrl: record.sourceUrl,
    mapSha256: review.mapSha256,
    mapGenerationDateFromContent: null,
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

describe("range evidence across all ZCTA county intersections", () => {
  it("does not promote one county's evidence across a secondary county intersection", () => {
    const secondaryCountyRecord = record({
      countyFips: "27123",
      geographicScope: "County FIPS 27123.",
    });
    expect(
      affirmativeCountyEvidenceForPlant(
        "plant-a",
        ["27053", "27123"],
        [secondaryCountyRecord],
        sources,
      ),
    ).toEqual([]);
  });

  it("does not allow one affirmative county to cover a non-native county", () => {
    const primaryNotNative = record({ nativityStatus: "not_native" });
    const secondaryNative = record({
      countyFips: "27123",
      geographicScope: "County FIPS 27123.",
    });
    const summary = summarizeNativeRangeEvidence({
      candidateIds: ["plant-a"],
      countyFips: ["27053", "27123"],
      geographyResolved: true,
      catalogAvailable: true,
      evidence: [primaryNotNative, secondaryNative],
      sources,
    });
    expect(summary).toMatchObject({
      status: "no_local_evidence",
      affirmativeCount: 0,
      notNativeCount: 0,
      unknownCount: 1,
    });
  });

  it("requires affirmative claims for every county intersection", () => {
    const primaryNative = record();
    const secondaryNative = record({
      countyFips: "27123",
      geographicScope: "County FIPS 27123.",
    });
    const summary = summarizeNativeRangeEvidence({
      candidateIds: ["plant-a"],
      countyFips: ["27053", "27123"],
      geographyResolved: true,
      catalogAvailable: true,
      evidence: [primaryNative, secondaryNative],
      sources,
    });

    expect(summary).toMatchObject({
      status: "affirmative_evidence",
      affirmativeCount: 1,
      unknownCount: 0,
      countyIntersectionCount: 2,
      evidenceSourceIds: ["usda-plants"],
      affirmativeSourceIds: ["usda-plants"],
    });
    expect(
      affirmativeCountyEvidenceForPlant(
        "plant-a",
        ["27053", "27123"],
        [primaryNative, secondaryNative],
        sources,
      ),
    ).toEqual([primaryNative, secondaryNative]);
  });

  it("returns and counts opposing eligible source claims for the same county", () => {
    const usdaNative = record({
      releaseOrObservationDate: "2025-03-14",
      sourceCitation: "USDA PLANTS County MapServer, county FIPS 27053.",
    });
    const bonapHistoric = record({
      sourceId: "bonap-napa",
      sourceCitation: "BONAP NAPA county map, county FIPS 27053.",
      sourceUrl: bonapMapUrl,
      releaseOrObservationDate: "2014-12-14",
      nativityStatus: "not_native",
      bonapReview: {
        mapSha256: bonapMapSha256,
        mapKeyUrl: "http://bonap.org/MapKey.html",
        mapGenerationDate: "2014-12-14",
        mapGenerationDateSource: "png_content_metadata",
        etag: '"map"',
        lastModified: "Fri, 19 May 2017 00:00:00 GMT",
        rawCategory: "Native Historic",
        taxonomyMatch: "exact",
        mapScopeDecision: "confirmed_taxon_scope",
        reviewStatus: "approved",
        currentStatusConfirmed: true,
        reviewer: "native-data-reviewer",
        reviewedAt: "2026-10-01T12:00:00.000Z",
        reviewNote: "Reviewed against image and MapKey.",
      },
    });
    const evidence = [usdaNative, bonapHistoric];
    const allSources = { ...sources, ...bonapSources };
    const currentSnapshot = [{
      mapUrl: bonapMapUrl,
      sha256: bonapMapSha256,
      mapKeyUrl: "http://bonap.org/MapKey.html",
      retrievedAt: "2026-10-01T12:00:00.000Z",
      etag: '"map"',
      lastModified: "Fri, 19 May 2017 00:00:00 GMT",
      mapGenerationDate: "2014-12-14",
      mapGenerationDateSource: "png_content_metadata" as const,
    }];
    const currentReviews = [approvedReviewFor(bonapHistoric)];

    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      "27053",
      evidence,
      allSources,
      currentSnapshot,
      null,
      currentReviews,
    )).toEqual([]);
    const conflicts = conflictingCountyEvidenceForPlant(
      "plant-a",
      "27053",
      evidence,
      allSources,
      currentSnapshot,
      null,
      currentReviews,
    );
    expect(conflicts).toEqual(evidence);
    expect(conflicts.map((claim) => ({
      sourceId: claim.sourceId,
      releaseOrObservationDate: claim.releaseOrObservationDate,
      spatialResolution: claim.spatialResolution,
      countyFips: claim.countyFips,
      nativityStatus: claim.nativityStatus,
    }))).toEqual([
      {
        sourceId: "usda-plants",
        releaseOrObservationDate: "2025-03-14",
        spatialResolution: "county",
        countyFips: "27053",
        nativityStatus: "native",
      },
      {
        sourceId: "bonap-napa",
        releaseOrObservationDate: "2014-12-14",
        spatialResolution: "county",
        countyFips: "27053",
        nativityStatus: "not_native",
      },
    ]);
    expect(summarizeNativeRangeEvidence({
      candidateIds: ["plant-a"],
      countyFips: "27053",
      geographyResolved: true,
      catalogAvailable: true,
      evidence,
      sources: allSources,
      currentBonapMapSnapshots: currentSnapshot,
      currentBonapMapReviews: currentReviews,
    })).toMatchObject({
      status: "no_local_evidence",
      affirmativeCount: 0,
      notNativeCount: 0,
      conflictCount: 1,
      unknownCount: 1,
      evidenceSourceIds: ["bonap-napa", "usda-plants"],
    });
  });

  it("uses an exact ZCTA footprint for a multi-county ZIP and rejects a different ZCTA in the same county", () => {
    const finerEvidenceOutsideZip = record({
      sourceId: "example-atlas",
      sourceCitation: "Example Botanical Atlas ZCTA range record.",
      sourceUrl: "https://flora.example/range-data/plant-a",
      licenseNote: "Reuse with attribution.",
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55111" },
      geographicScope: "Census 2010 ZCTA 55111, within county FIPS 27053.",
    });
    const matchingFootprint = record({
      ...finerEvidenceOutsideZip,
      finerArea: { geography: "census-zcta-2010", zctaId: "55401" },
      geographicScope: "Census 2010 ZCTA 55401, overlapping county FIPS 27053 and 27123.",
    });
    const summary = summarizeNativeRangeEvidence({
      candidateIds: ["plant-a"],
      countyFips: ["27053", "27123"],
      geographyResolved: true,
      catalogAvailable: true,
      evidence: [finerEvidenceOutsideZip],
      sources: finerSources,
      targetZctaId: "55401",
    });

    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      ["27053", "27123"],
      [finerEvidenceOutsideZip],
      finerSources,
      [],
      "55401",
    )).toEqual([]);
    expect(summary).toMatchObject({
      status: "no_local_evidence",
      affirmativeCount: 0,
      missingCount: 1,
      unknownCount: 0,
    });

    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      ["27053", "27123"],
      [matchingFootprint],
      finerSources,
      [],
      "55401",
    )).toEqual([matchingFootprint]);
    expect(summarizeNativeRangeEvidence({
      candidateIds: ["plant-a"],
      countyFips: ["27053", "27123"],
      geographyResolved: true,
      catalogAvailable: true,
      evidence: [matchingFootprint],
      sources: finerSources,
      targetZctaId: "55401",
    })).toMatchObject({
      status: "affirmative_evidence",
      affirmativeCount: 1,
      unknownCount: 0,
      countyIntersectionCount: 2,
      evidenceSourceIds: ["example-atlas"],
    });
  });

  it("uses affirmative whole-ZCTA evidence over a conflicting county claim and returns the conflict", () => {
    const finerNative = record({
      sourceId: "example-atlas",
      sourceCitation: "Example Botanical Atlas ZCTA range record.",
      sourceUrl: "https://flora.example/range-data/plant-a",
      licenseNote: "Reuse with attribution.",
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55401" },
      geographicScope: "Census 2010 ZCTA 55401.",
    });
    const countyNotNative = record({ nativityStatus: "not_native" });
    const evidence = [finerNative, countyNotNative];
    const allSources = { ...sources, ...finerSources };

    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      ["27053", "27123"],
      evidence,
      allSources,
      [],
      "55401",
    )).toEqual([finerNative]);
    expect(conflictingCountyEvidenceForPlant(
      "plant-a",
      ["27053", "27123"],
      evidence,
      allSources,
      [],
      "55401",
    )).toEqual([finerNative, countyNotNative]);
    expect(summarizeNativeRangeEvidence({
      candidateIds: ["plant-a"],
      countyFips: ["27053", "27123"],
      geographyResolved: true,
      catalogAvailable: true,
      evidence,
      sources: allSources,
      targetZctaId: "55401",
    })).toMatchObject({
      status: "affirmative_evidence",
      affirmativeCount: 1,
      notNativeCount: 0,
      conflictCount: 1,
      evidenceSourceIds: ["example-atlas", "usda-plants"],
      affirmativeSourceIds: ["example-atlas"],
      notNativeSourceIds: ["usda-plants"],
    });
  });

  it("keeps an unknown BONAP county category visible without reporting it as a conflict with finer native evidence", () => {
    const finerNative = record({
      sourceId: "example-atlas",
      sourceCitation: "Example Botanical Atlas ZCTA range record.",
      sourceUrl: "https://flora.example/range-data/plant-a",
      licenseNote: "Reuse with attribution.",
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55401" },
      geographicScope: "Census 2010 ZCTA 55401.",
    });
    const bonapUnknown = record({
      sourceId: "bonap-napa",
      sourceCitation: "BONAP NAPA current county map.",
      sourceUrl: bonapMapUrl,
      releaseOrObservationDate: "2014-12-14",
      nativityStatus: "unknown",
      bonapReview: {
        mapSha256: bonapMapSha256,
        mapKeyUrl: "http://bonap.org/MapKey.html",
        mapGenerationDate: "2014-12-14",
        mapGenerationDateSource: "png_content_metadata",
        etag: '"map"',
        lastModified: "Fri, 19 May 2017 00:00:00 GMT",
        rawCategory: "rare",
        taxonomyMatch: "exact",
        mapScopeDecision: "confirmed_taxon_scope",
        reviewStatus: "approved",
        currentStatusConfirmed: true,
        reviewer: "native-data-reviewer",
        reviewedAt: "2026-10-01T12:00:00.000Z",
        reviewNote: "The raw county category is not defined by the reviewed MapKey.",
      },
    });
    const evidence = [finerNative, bonapUnknown];
    const allSources = { ...bonapSources, ...finerSources };
    const currentSnapshot = [{
      mapUrl: bonapMapUrl,
      sha256: bonapMapSha256,
      mapKeyUrl: "http://bonap.org/MapKey.html",
      retrievedAt: "2026-10-01T12:00:00.000Z",
      etag: '"map"',
      lastModified: "Fri, 19 May 2017 00:00:00 GMT",
      mapGenerationDate: "2014-12-14",
      mapGenerationDateSource: "png_content_metadata" as const,
    }];
    const currentReviews = [approvedReviewFor(bonapUnknown)];

    expect(bonapUnknown.nativityStatus).toBe("unknown");
    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      ["27053", "27123"],
      evidence,
      allSources,
      currentSnapshot,
      "55401",
      currentReviews,
    )).toEqual([finerNative]);
    expect(conflictingCountyEvidenceForPlant(
      "plant-a",
      ["27053", "27123"],
      evidence,
      allSources,
      currentSnapshot,
      "55401",
      currentReviews,
    )).toEqual([]);
    expect(summarizeNativeRangeEvidence({
      candidateIds: ["plant-a"],
      countyFips: ["27053", "27123"],
      geographyResolved: true,
      catalogAvailable: true,
      evidence,
      sources: allSources,
      currentBonapMapSnapshots: currentSnapshot,
      currentBonapMapReviews: currentReviews,
      targetZctaId: "55401",
    })).toMatchObject({
      status: "affirmative_evidence",
      affirmativeCount: 1,
      conflictCount: 0,
      unknownCount: 0,
      unknownCountyCount: 1,
      evidenceSourceIds: ["bonap-napa", "example-atlas"],
    });
  });

  it("exposes both sides when not-native whole-ZCTA evidence conflicts with a native county claim", () => {
    const finerNotNative = record({
      sourceId: "example-atlas",
      sourceCitation: "Example Botanical Atlas ZCTA range record.",
      sourceUrl: "https://flora.example/range-data/plant-a",
      licenseNote: "Reuse with attribution.",
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55401" },
      geographicScope: "Census 2010 ZCTA 55401.",
      nativityStatus: "not_native",
    });
    const countyNative = record();
    const evidence = [finerNotNative, countyNative];
    const allSources = { ...sources, ...finerSources };

    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      ["27053", "27123"],
      evidence,
      allSources,
      [],
      "55401",
    )).toEqual([]);
    expect(conflictingCountyEvidenceForPlant(
      "plant-a",
      ["27053", "27123"],
      evidence,
      allSources,
      [],
      "55401",
    )).toEqual([finerNotNative, countyNative]);
    expect(summarizeNativeRangeEvidence({
      candidateIds: ["plant-a"],
      countyFips: ["27053", "27123"],
      geographyResolved: true,
      catalogAvailable: true,
      evidence,
      sources: allSources,
      targetZctaId: "55401",
    })).toMatchObject({
      status: "not_native_evidence",
      affirmativeCount: 0,
      notNativeCount: 1,
      conflictCount: 1,
      unknownCount: 0,
      evidenceSourceIds: ["example-atlas", "usda-plants"],
      notNativeSourceIds: ["example-atlas"],
    });
  });

  it("rejects BONAP reviews whose hash or map URL is absent from the current snapshot", () => {
    const reviewed = record({
      sourceId: "bonap-napa",
      sourceCitation: "BONAP NAPA current county map.",
      sourceUrl: bonapMapUrl,
      releaseOrObservationDate: "2014-12-14",
      bonapReview: {
        mapSha256: bonapMapSha256,
        mapKeyUrl: "http://bonap.org/MapKey.html",
        mapGenerationDate: "2014-12-14",
        mapGenerationDateSource: "png_content_metadata",
        etag: '"map"',
        lastModified: "Fri, 19 May 2017 00:00:00 GMT",
        rawCategory: "Native",
        taxonomyMatch: "exact",
        mapScopeDecision: "confirmed_taxon_scope",
        reviewStatus: "approved",
        currentStatusConfirmed: true,
        reviewer: "native-data-reviewer",
        reviewedAt: "2026-10-01T12:00:00.000Z",
        reviewNote: "Reviewed map and key.",
      },
    });
    const currentSnapshot = [{
      mapUrl: bonapMapUrl,
      sha256: bonapMapSha256,
      mapKeyUrl: "http://bonap.org/MapKey.html",
      retrievedAt: "2026-10-01T12:00:00.000Z",
      etag: '"map"',
      lastModified: "Fri, 19 May 2017 00:00:00 GMT",
      mapGenerationDate: "2014-12-14",
      mapGenerationDateSource: "png_content_metadata" as const,
    }];
    const currentReviews = [approvedReviewFor(reviewed)];
    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      "27053",
      [reviewed],
      bonapSources,
      currentSnapshot,
      null,
      currentReviews,
    )).toEqual([reviewed]);
    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      "27053",
      [reviewed],
      bonapSources,
      [{ ...currentSnapshot[0], sha256: "b".repeat(64) }],
      null,
      currentReviews,
    )).toEqual([]);
    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      "27053",
      [reviewed],
      bonapSources,
      [{ ...currentSnapshot[0], mapUrl: "https://bonap.net/MapGallery/County/Other%20taxon.png" }],
      null,
      currentReviews,
    )).toEqual([]);
  });

  it("does not treat a binomial map that may combine infraspecific taxa as a species claim", () => {
    const unresolvedScope = record({
      sourceId: "bonap-napa",
      sourceCitation: "BONAP NAPA current county map.",
      sourceUrl: bonapMapUrl,
      nativityStatus: "unknown",
      bonapReview: {
        mapSha256: bonapMapSha256,
        mapKeyUrl: "http://bonap.org/MapKey.html",
        mapGenerationDate: "2014-12-14",
        mapGenerationDateSource: "png_content_metadata",
        etag: '"map"',
        lastModified: "Fri, 19 May 2017 00:00:00 GMT",
        rawCategory: "Native",
        taxonomyMatch: "exact",
        mapScopeDecision: "may_conflate_infraspecific",
        reviewStatus: "approved",
        currentStatusConfirmed: true,
        reviewer: "native-data-reviewer",
        reviewedAt: "2026-10-01T12:00:00.000Z",
        reviewNote: "BONAP's map legend warns species maps can combine infraspecific taxa.",
      },
    });
    const currentSnapshot = [{
      mapUrl: bonapMapUrl,
      sha256: bonapMapSha256,
      mapKeyUrl: "http://bonap.org/MapKey.html",
      retrievedAt: "2026-10-01T12:00:00.000Z",
      etag: '"map"',
      lastModified: "Fri, 19 May 2017 00:00:00 GMT",
      mapGenerationDate: "2014-12-14",
      mapGenerationDateSource: "png_content_metadata" as const,
    }];
    const currentReviews = [approvedReviewFor(unresolvedScope)];

    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      "27053",
      [unresolvedScope],
      bonapSources,
      currentSnapshot,
      null,
      currentReviews,
    )).toEqual([]);
    expect(affirmativeCountyEvidenceForPlant(
      "plant-a",
      "27053",
      [{ ...unresolvedScope, nativityStatus: "native" }],
      bonapSources,
      currentSnapshot,
      null,
      currentReviews,
    )).toEqual([]);
  });

  it("does not call partial not-native evidence a ZIP-wide not-native result", () => {
    const oneCountyOnly = record({ nativityStatus: "not_native" });
    const summary = summarizeNativeRangeEvidence({
      candidateIds: ["plant-a"],
      countyFips: ["27053", "27123"],
      geographyResolved: true,
      catalogAvailable: true,
      evidence: [oneCountyOnly],
      sources,
    });
    expect(summary).toMatchObject({
      status: "no_local_evidence",
      notNativeCount: 0,
      unknownCount: 1,
      missingCount: 0,
    });
  });

  it("does not treat state-only or unknown records as affirmative county evidence", () => {
    const stateOnly = record({ spatialResolution: "state" });
    const unknownCounty = record({ nativityStatus: "unknown" });
    expect(
      affirmativeCountyEvidenceForPlant("plant-a", "27053", [stateOnly], sources),
    ).toEqual([]);
    expect(
      affirmativeCountyEvidenceForPlant("plant-a", "27053", [unknownCounty], sources),
    ).toEqual([]);
  });

  it("keeps conflicting claims for one county unknown", () => {
    const native = record();
    const introduced = record({ nativityStatus: "not_native" });
    expect(
      affirmativeCountyEvidenceForPlant("plant-a", "27053", [native, introduced], sources),
    ).toEqual([]);
  });
});
