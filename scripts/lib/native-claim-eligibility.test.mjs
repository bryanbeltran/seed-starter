import { describe, expect, it } from "vitest";
import {
  isAffirmativeRangeClaims,
  isEligibleFinerRangeEvidenceRecord,
  isEligibleRangeEvidenceClaim,
} from "./native-claim-eligibility.mjs";

const source = {
  authority: "USDA PLANTS",
  rangeEvidenceAvailable: true,
  licenseNote: "Reusable with citation.",
};
const sources = { "usda-plants": source };
const finerSource = {
  authority: "Example Botanical Atlas",
  url: "https://flora.example/range-data",
  rangeEvidenceAvailable: true,
  sourceTermsStatus: "verified",
  licenseNote: "Reuse with attribution.",
  verifiedFinerAreaGeographies: ["census-zcta-2010"],
};
const finerSources = { "example-atlas": finerSource };
const countyRecord = {
  plantId: "plant-a",
  sourceId: "usda-plants",
  sourceCitation: "USDA PLANTS county map.",
  sourceUrl: "https://plants.usda.gov/",
  spatialResolution: "county",
  countyFips: "27053",
  nativityStatus: "native",
  licenseNote: "Reusable with citation.",
};
const bonapMapUrl = "https://bonap.net/MapGallery/County/Echinacea%20purpurea.png";
const bonapMapSha256 = "a".repeat(64);
const bonapSource = {
  authority: "Biota of North America Program (BONAP)",
  url: "https://bonap.net/Napa/TaxonMaps/Genus/County/Echinacea",
  rangeEvidenceAvailable: true,
  sourceTermsStatus: "verified",
  ownerAuthorizationNote: "Project owner confirms written permission.",
  licenseNote: "Reusable with permission and citation.",
};
const bonapReview = {
  plantId: "plant-a",
  scientificName: "Echinacea purpurea",
  mapUrl: bonapMapUrl,
  mapSha256: bonapMapSha256,
  mapGenerationDateFromContent: "2014-12-14",
  reviewStatus: "approved",
  taxonomyMatch: "exact",
  mapScopeDecision: "confirmed_taxon_scope",
  currentStatusConfirmed: true,
  reviewer: "native-data-reviewer",
  reviewedAt: "2026-10-01T12:00:00.000Z",
  reviewNote: "Reviewed map and MapKey.",
  counties: [{ countyFips: "27053", rawCategory: "Native" }],
};
const bonapRecord = {
  ...countyRecord,
  sourceId: "bonap-napa",
  sourceCitation: "BONAP North American Plant Atlas county map.",
  sourceUrl: bonapMapUrl,
  releaseOrObservationDate: "2014-12-14",
  retrievedAt: "2026-10-01T12:00:00.000Z",
  countyFips: "27053",
  bonapReview: {
    mapSha256: bonapMapSha256,
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
    reviewNote: "Reviewed map and MapKey.",
  },
};
const bonapSources = { "bonap-napa": bonapSource };
const bonapMapSnapshots = [{
  mapUrl: bonapMapUrl,
  sha256: bonapMapSha256,
  mapKeyUrl: "http://bonap.org/MapKey.html",
  retrievedAt: "2026-10-01T12:00:00.000Z",
  etag: '"d5988b42bfd0d21:0"',
  lastModified: "Fri, 19 May 2017 00:00:00 GMT",
  mapGenerationDate: "2014-12-14",
  mapGenerationDateSource: "png_content_metadata",
}];

describe("native claim spatial eligibility", () => {
  it("requires county-wide evidence unless a finer footprint can be verified", () => {
    const finerRecordOutsideZip = {
      ...countyRecord,
      sourceId: "example-atlas",
      sourceCitation: "Example Botanical Atlas ZCTA range record.",
      sourceUrl: "https://flora.example/range-data/plant-a",
      licenseNote: "Reuse with attribution.",
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55111" },
      geographicScope: "Census 2010 ZCTA 55111, within county FIPS 27053.",
    };
    const matchingFootprint = {
      ...finerRecordOutsideZip,
      finerArea: { geography: "census-zcta-2010", zctaId: "55401" },
      geographicScope: "Census 2010 ZCTA 55401, overlapping county FIPS 27053 and 27123.",
    };

    expect(isEligibleRangeEvidenceClaim(countyRecord, sources)).toBe(true);
    expect(isEligibleRangeEvidenceClaim(matchingFootprint, finerSources, [], "55401")).toBe(true);
    expect(isEligibleFinerRangeEvidenceRecord(matchingFootprint, finerSources)).toBe(true);
    expect(isAffirmativeRangeClaims([matchingFootprint], finerSources, [], "55401")).toBe(true);
    expect(isEligibleRangeEvidenceClaim(finerRecordOutsideZip, finerSources, [], "55401")).toBe(false);
    expect(isAffirmativeRangeClaims([finerRecordOutsideZip], finerSources, [], "55401")).toBe(false);
    expect(isEligibleRangeEvidenceClaim(matchingFootprint, finerSources)).toBe(false);

    const countyOnlyFinerRecord = {
      ...matchingFootprint,
      sourceId: "usda-plants",
      sourceCitation: "USDA PLANTS county map.",
      sourceUrl: countyRecord.sourceUrl,
      licenseNote: "Reusable with citation.",
    };
    const configuredUsdaSource = {
      ...source,
      url: "https://plants.usda.gov",
      sourceTermsStatus: "verified",
      verifiedFinerAreaGeographies: ["census-zcta-2010"],
    };
    expect(isEligibleRangeEvidenceClaim(countyOnlyFinerRecord, {
      "usda-plants": configuredUsdaSource,
    }, [], "55401")).toBe(false);
  });

  it("requires BONAP county claims to match an approved canonical map conversion", () => {
    expect(isEligibleRangeEvidenceClaim(
      bonapRecord,
      bonapSources,
      bonapMapSnapshots,
      null,
      [bonapReview],
    )).toBe(true);
    expect(isEligibleRangeEvidenceClaim(
      { ...bonapRecord, countyFips: "01000" },
      bonapSources,
      bonapMapSnapshots,
      null,
      [bonapReview],
    )).toBe(false);
    expect(isEligibleRangeEvidenceClaim(
      { ...bonapRecord, countyFips: "27123" },
      bonapSources,
      bonapMapSnapshots,
      null,
      [bonapReview],
    )).toBe(false);
    expect(isEligibleRangeEvidenceClaim(
      { ...bonapRecord, bonapReview: { ...bonapRecord.bonapReview, rawCategory: "Native Historic" } },
      bonapSources,
      bonapMapSnapshots,
      null,
      [bonapReview],
    )).toBe(false);
  });

  it("binds BONAP claim dates and update markers to the matching map snapshot", () => {
    expect(isEligibleRangeEvidenceClaim(
      bonapRecord,
      bonapSources,
      bonapMapSnapshots,
      null,
      [bonapReview],
    )).toBe(true);

    const lastModifiedPresentedAsGenerationDate = {
      ...bonapRecord,
      releaseOrObservationDate: "2017-05-19",
      bonapReview: {
        ...bonapRecord.bonapReview,
        mapGenerationDate: "2017-05-19",
      },
    };
    expect(isEligibleRangeEvidenceClaim(
      lastModifiedPresentedAsGenerationDate,
      bonapSources,
      bonapMapSnapshots,
      null,
      [bonapReview],
    )).toBe(false);
    expect(isEligibleRangeEvidenceClaim(
      { ...bonapRecord, retrievedAt: "2026-10-02T12:00:00.000Z" },
      bonapSources,
      bonapMapSnapshots,
      null,
      [bonapReview],
    )).toBe(false);
    expect(isEligibleRangeEvidenceClaim(
      {
        ...bonapRecord,
        bonapReview: { ...bonapRecord.bonapReview, etag: '"different-map"' },
      },
      bonapSources,
      bonapMapSnapshots,
      null,
      [bonapReview],
    )).toBe(false);
    expect(isEligibleRangeEvidenceClaim(
      {
        ...bonapRecord,
        bonapReview: {
          ...bonapRecord.bonapReview,
          mapGenerationDateSource: "png_content_metadata",
        },
      },
      bonapSources,
      bonapMapSnapshots,
      null,
      [bonapReview],
    )).toBe(false);
    expect(isEligibleRangeEvidenceClaim(
      {
        ...bonapRecord,
        bonapReview: {
          ...bonapRecord.bonapReview,
          lastModified: "Fri, 20 May 2017 00:00:00 GMT",
        },
      },
      bonapSources,
      bonapMapSnapshots,
      null,
      [bonapReview],
    )).toBe(false);
  });
});
