import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildNativeCoverageReport } from "./check-native-coverage.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

function reportWithEvidence(rangeEvidence, countyData = {
  zips: { "55423": "27053" },
  intersections: { "55423": [{ fips: "27053", stateFips: "27" }] },
  counties: { "27053": { name: "Hennepin", state: "MN" } },
}, supplemental = {}) {
  return buildNativeCoverageReport({
    countyData,
    ecoregionData: {
      names: { "51": "Northern Glaciated Plains" },
      zips: { "55423": "51" },
    },
    ecoregionPlants: {
      ecoregions: { "51": { plantIds: ["echinacea-purpurea"] } },
    },
    plants: { "echinacea-purpurea": {} },
    sources: {
      "usda-plants": {
        authority: "USDA PLANTS",
        rangeEvidenceAvailable: true,
        licenseNote: "Freely reusable with citation.",
      },
      "bonap-napa": {
        authority: "Biota of North America Program (BONAP)",
        rangeEvidenceAvailable: false,
        licenseNote: "BONAP requires advance written permission; permission is confirmed for this project.",
        sourceTermsStatus: "verified",
        ownerAuthorizationNote: "The project owner confirms permission to bundle BONAP data.",
      },
      npin: {
        authority: "Lady Bird Johnson Wildflower Center (NPIN)",
        rangeEvidenceAvailable: false,
        licenseNote: "The published policy permits non-commercial data use with attribution.",
        sourceTermsStatus: "verified",
        ownerAuthorizationNote: "The project owner separately confirms permission to scrape NPIN data.",
      },
      ...(supplemental.sources ?? {}),
    },
    rangeEvidence,
    sourceIngestion: supplemental.sourceIngestion,
    refreshStatus: supplemental.refreshStatus,
  });
}

const affirmativeRecord = {
  plantId: "echinacea-purpurea",
  sourceId: "usda-plants",
  sourceCitation: "USDA, NRCS. PLANTS Database.",
  sourceUrl: "https://plants.usda.gov/plant-profile?symbol=ECPU",
  spatialResolution: "county",
  countyFips: "27053",
  nativityStatus: "native",
  licenseNote: "Freely reusable with citation.",
};

describe("offline native coverage report", () => {
  it("reports current county, ecoregion, catalog, and range-evidence gaps", () => {
    const report = buildNativeCoverageReport({
      countyData: read("data/natives/zip-county.json"),
      ecoregionData: read("data/natives/zip-ecoregion.json"),
      ecoregionPlants: read("data/natives/ecoregion-plants.json"),
      plants: read("data/natives/plants.json").plants,
      sources: read("data/natives/native-sources.json").sources,
      rangeEvidence: read("data/natives/plant-range-evidence.json").records,
      sourceIngestion: read("data/natives/native-source-ingestion.json"),
      bonapMapReviews: read("data/natives/bonap-county-map-reviews.json"),
    });

    expect(report.geography).toMatchObject({
      lower48StateCount: 48,
      lower48ZctaCount: 32604,
      primaryCountyNameResolvedZctaCount: 32597,
      countyMappedZctaCount: 32604,
      countyMappingGapCount: 0,
      unresolvedCountyStateZctaCount: 0,
      countyMetadataGapZctaCount: 10,
      ecoregionMappedZctaCount: 32537,
      zctasWithoutEcoregion: 67,
    });
    expect(report.geography.countyMetadataGapsByFips).toEqual([
      { countyFips: "46113", state: "South Dakota", stateCode: "SD", zctaCount: 9 },
      { countyFips: "51515", state: "Virginia", stateCode: "VA", zctaCount: 1 },
    ]);
    expect(report.catalog.mappedZctaCount).toBe(3168);
    expect(report.catalog.mappedZctaCountWithResolvedPrimaryCountyMetadata).toBe(3165);
    expect(report.catalog.mappedZctaCountWithCountyMetadataGaps).toBe(3);
    expect(report.catalog.statesWithNoCatalog).toHaveLength(28);
    expect(report.catalog.statesWithPartialCatalog).toHaveLength(20);
    expect(report.catalog.statesWithFullCatalog).toEqual([]);
    expect(report.localRangeEvidence).toEqual({
      recordCount: 0,
      unresolvedCountyFipsRecordCount: 0,
      catalogMappedZctasWithAnyCountyEvidence: 0,
      catalogMappedZctasWithCompleteAffirmativeCoverage: 0,
      catalogMappedZctasWithAffirmativeEvidence: 0,
      catalogMappedZctasWithNotNativeEvidence: 0,
      catalogMappedZctasWithoutLocalEvidence: 3168,
    });
    expect(report.states).toHaveLength(48);
    expect(report.states.map((state) => state.state)).toContain("California");
    expect(report.states.every((state) => "gaps" in state)).toBe(true);
    expect(report.sourceDiscovery.bonap).toMatchObject({
      status: "not_refreshed",
      fullTaxonListTaxonCount: 0,
      tdcOccurrenceCountyCount: 0,
      napaMapTaxonCount: 0,
      lower48StateCoverage: expect.arrayContaining([
        expect.objectContaining({ stateCode: "MN", tdcOccurrenceCountyFipsCount: 0 }),
      ]),
    });
    expect(report.sourceDiscovery.npin).toMatchObject({
      status: "not_refreshed",
      nativityEvidenceRecordCount: 0,
    });
    expect(report.baselineComparison).toMatchObject({
      baseline: {
        measuredAt: "2026-10-01",
        lower48ZctasWithCountyIntersections: 32604,
        lower48ZctasWithEcoregion: 32537,
        catalogMappedZctas: 3168,
        rangeEvidenceRecords: 0,
      },
      current: { zctasWithCompleteAffirmativeNativityCoverage: 0 },
      mappingCountsAreNotNativityCoverage: true,
    });
  });

  it("keeps owner authorization, source terms, and source readiness distinct", () => {
    const sources = read("data/natives/native-sources.json").sources;
    expect(sources["usda-plants"].authority).toBe("USDA PLANTS");
    expect(sources["usda-plants"].licenseNote).toContain("freely with citation");
    expect(sources["epa-level-iii"].authority).toBe(
      "U.S. Environmental Protection Agency",
    );
    expect(sources["census-zcta-county"].authority).toBe("U.S. Census Bureau");
    expect(sources["bonap-napa"]).toMatchObject({
      ownerAuthorizationNote: expect.stringContaining("confirms that BONAP's required advance written permission"),
      sourceTermsStatus: "verified",
      sourceCheckDate: "2026-10-01",
      retrievedAt: null,
      sourceStatusCategories: ["Native", "Native Historic", "Adventive", "Exotic", "rare"],
      rangeEvidenceAvailable: true,
    });
    expect(sources["bonap-napa"].citation).toContain(
      "https://bonap.net/TDC/Query/SpeciesList",
    );
    expect(sources["bonap-napa"].uncertainty).toContain(
      "Only an approved exact taxonomy match",
    );
    expect(sources["npin"]).toMatchObject({
      ownerAuthorizationNote: expect.stringContaining("separately confirms permission"),
      sourceTermsStatus: "verified",
      sourceCheckDate: "2026-10-01",
      retrievedAt: null,
      rangeEvidenceAvailable: false,
    });
    expect(sources.npin.citation).toContain(
      "https://www.wildflower.org/wp-json/wp/v2/pages?slug=plants-main",
    );
    expect(sources.npin.coverage).toContain(
      "common name, scientific name, genus, and ID only",
    );
  });

  it("reports source-level lower-48 coverage without admitting disabled BONAP or NPIN claims", () => {
    const bonapRecord = {
      ...affirmativeRecord,
      sourceId: "bonap-napa",
      sourceCitation: "BONAP. North American Plant Atlas.",
      sourceUrl: "https://bonap.org/",
    };
    const npinRecord = {
      ...affirmativeRecord,
      sourceId: "npin",
      sourceCitation: "Lady Bird Johnson Wildflower Center. NPIN.",
      sourceUrl: "https://www.wildflower.org/plants/",
    };
    const report = reportWithEvidence([bonapRecord, npinRecord]);
    const bonap = report.sourceEvidence.find((source) => source.sourceId === "bonap-napa");
    const npin = report.sourceEvidence.find((source) => source.sourceId === "npin");
    const minnesota = report.states.find((state) => state.stateCode === "MN");

    expect(bonap).toMatchObject({
      ownerAuthorizationStatus: "authorized",
      sourceTermsStatus: "verified",
      rangeEvidenceAvailable: false,
      recordCount: 1,
      countyOrFinerRecordCount: 1,
      lower48CountyFipsCount: 1,
      lower48StateCount: 1,
      statesWithCountyEvidence: [
        { stateCode: "MN", state: "Minnesota", stateFips: "27" },
      ],
    });
    expect(bonap.lower48StateCoverage).toHaveLength(48);
    expect(bonap.lower48StateCoverage).toContainEqual(expect.objectContaining({
      stateCode: "MN",
      state: "Minnesota",
      stateFips: "27",
      countyOrFinerRecordCount: 1,
      countyFipsCount: 1,
      eligibleCountyOrFinerRecordCount: 0,
      affirmativeCountyFipsCount: 0,
    }));
    expect(bonap.lower48StateCoverage.find((state) => state.stateCode === "AL")).toMatchObject({
      countyOrFinerRecordCount: 0,
      countyFipsCount: 0,
    });
    expect(npin).toMatchObject({
      ownerAuthorizationStatus: "authorized",
      sourceTermsStatus: "verified",
      rangeEvidenceAvailable: false,
      recordCount: 1,
      lower48CountyFipsCount: 1,
    });
    expect(minnesota).toMatchObject({
      localRangeEvidenceZctaCount: 0,
      affirmativeRangeEvidenceZctaCount: 0,
    });
  });

  it("counts only cited USDA county records as local evidence and requires known licensing to affirm", () => {
    const affirmed = reportWithEvidence([affirmativeRecord]);
    const minnesota = affirmed.states.find((state) => state.stateCode === "MN");
    expect(minnesota).toMatchObject({
      localRangeEvidenceZctaCount: 1,
      affirmativeRangeEvidenceZctaCount: 1,
    });

    const external = reportWithEvidence([
      { ...affirmativeRecord, sourceUrl: "https://example.org/ranges.csv" },
    ]).states.find((state) => state.stateCode === "MN");
    expect(external).toMatchObject({
      localRangeEvidenceZctaCount: 0,
      affirmativeRangeEvidenceZctaCount: 0,
    });

    const unknownLicense = reportWithEvidence([
      { ...affirmativeRecord, licenseNote: null },
    ]).states.find((state) => state.stateCode === "MN");
    expect(unknownLicense).toMatchObject({
      localRangeEvidenceZctaCount: 1,
      affirmativeRangeEvidenceZctaCount: 0,
    });
  });

  it("counts a verified whole-ZCTA footprint only for its matching multi-county ZCTA", () => {
    const countyData = {
      zips: { "55423": "27053" },
      intersections: {
        "55423": [
          { fips: "27053", stateFips: "27" },
          { fips: "27123", stateFips: "27" },
        ],
      },
      counties: {
        "27053": { name: "Hennepin", state: "MN" },
        "27123": { name: "Ramsey", state: "MN" },
      },
    };
    const source = {
      authority: "Example Botanical Atlas",
      url: "https://flora.example/range-data",
      rangeEvidenceAvailable: true,
      sourceTermsStatus: "verified",
      licenseNote: "Reuse with attribution.",
      verifiedFinerAreaGeographies: ["census-zcta-2010"],
    };
    const fineRecord = {
      plantId: "echinacea-purpurea",
      sourceId: "example-atlas",
      sourceCitation: "Example Botanical Atlas ZCTA range record.",
      sourceUrl: "https://flora.example/range-data/echinacea-purpurea",
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55423" },
      nativityStatus: "native",
      licenseNote: "Reuse with attribution.",
    };
    const sources = { "example-atlas": source };

    const matched = reportWithEvidence([fineRecord], countyData, { sources });
    expect(matched.localRangeEvidence).toMatchObject({
      recordCount: 1,
      catalogMappedZctasWithCompleteAffirmativeCoverage: 1,
      catalogMappedZctasWithAffirmativeEvidence: 1,
    });
    expect(matched.sourceEvidence.find((row) => row.sourceId === "example-atlas")).toMatchObject({
      finerAreaRecordCount: 1,
      eligibleFinerAreaRecordCount: 1,
      affirmativeFinerAreaRecordCount: 1,
      affirmativeFinerAreaZctaCount: 1,
    });

    const outside = reportWithEvidence([{
      ...fineRecord,
      finerArea: { geography: "census-zcta-2010", zctaId: "55424" },
    }], countyData, { sources });
    expect(outside.localRangeEvidence).toMatchObject({
      catalogMappedZctasWithCompleteAffirmativeCoverage: 0,
      catalogMappedZctasWithAffirmativeEvidence: 0,
    });
  });

  it("reports county claims whose FIPS crosswalk is unresolved", () => {
    const report = reportWithEvidence([
      { ...affirmativeRecord, countyFips: null },
    ]);

    expect(report.localRangeEvidence.unresolvedCountyFipsRecordCount).toBe(1);
    expect(report.states.find((state) => state.stateCode === "MN")).toMatchObject({
      localRangeEvidenceZctaCount: 0,
      affirmativeRangeEvidenceZctaCount: 0,
    });
  });

  it("indexes range records before checking ZIP and candidate coverage", () => {
    const rangeEvidence = new Proxy([affirmativeRecord], {
      get(target, property, receiver) {
        if (property === "filter") {
          throw new Error("The full evidence list must not be scanned per ZIP");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const report = buildNativeCoverageReport({
      countyData: {
        zips: { "55423": "27053", "55424": "27053" },
        intersections: {
          "55423": [{ fips: "27053", stateFips: "27" }],
          "55424": [{ fips: "27053", stateFips: "27" }],
        },
        counties: { "27053": { name: "Hennepin", state: "MN" } },
      },
      ecoregionData: {
        names: { "51": "Northern Glaciated Plains" },
        zips: { "55423": "51", "55424": "51" },
      },
      ecoregionPlants: {
        ecoregions: { "51": { plantIds: ["echinacea-purpurea"] } },
      },
      plants: { "echinacea-purpurea": {} },
      sources: {
        "usda-plants": {
          authority: "USDA PLANTS",
          rangeEvidenceAvailable: true,
          licenseNote: "Freely reusable with citation.",
        },
      },
      rangeEvidence,
    });

    const minnesota = report.states.find((state) => state.stateCode === "MN");
    expect(minnesota).toMatchObject({
      localRangeEvidenceZctaCount: 2,
      affirmativeRangeEvidenceZctaCount: 2,
    });
  });

  it("does not promote evidence in one county across a multi-county ZCTA", () => {
    const report = buildNativeCoverageReport({
      countyData: {
        zips: { "55423": "27053" },
        intersections: {
          "55423": [
            { fips: "27053", stateFips: "27" },
            { fips: "27123", stateFips: "27" },
          ],
        },
        counties: {
          "27053": { name: "Hennepin", state: "MN" },
          "27123": { name: "Ramsey", state: "MN" },
        },
      },
      ecoregionData: {
        names: { "51": "Northern Glaciated Plains" },
        zips: { "55423": "51" },
      },
      ecoregionPlants: {
        ecoregions: { "51": { plantIds: ["echinacea-purpurea"] } },
      },
      plants: { "echinacea-purpurea": {} },
      sources: {
        "usda-plants": {
          authority: "USDA PLANTS",
          rangeEvidenceAvailable: true,
          licenseNote: "Freely reusable with citation.",
        },
      },
      rangeEvidence: [{
        ...affirmativeRecord,
        countyFips: "27123",
      }],
    });

    expect(report.localRangeEvidence).toMatchObject({
      catalogMappedZctasWithAnyCountyEvidence: 1,
      catalogMappedZctasWithCompleteAffirmativeCoverage: 0,
      catalogMappedZctasWithAffirmativeEvidence: 0,
      catalogMappedZctasWithoutLocalEvidence: 0,
    });
  });

  it("does not count primary-county evidence when a ZCTA intersection list is missing", () => {
    const report = reportWithEvidence([affirmativeRecord], {
      zips: { "55423": "27053" },
      counties: { "27053": { name: "Hennepin", state: "MN" } },
    });
    expect(report.localRangeEvidence.catalogMappedZctasWithCompleteAffirmativeCoverage).toBe(0);
    expect(report.localRangeEvidence.catalogMappedZctasWithAffirmativeEvidence).toBe(0);
    expect(report.geography.unresolvedCountyStateZctaCount).toBe(1);
  });

  it("reports a failed current source attempt while retaining the last successful retrieval", () => {
    const lastSuccessAt = "2026-09-01T12:00:00.000Z";
    const report = reportWithEvidence([], undefined, {
      sourceIngestion: {
        retrievedAt: lastSuccessAt,
        bonap: { retrievedAt: lastSuccessAt, mapSnapshots: [] },
        npin: { retrievedAt: lastSuccessAt, enrichments: [] },
      },
      refreshStatus: {
        version: "1",
        startedAt: "2026-10-01T12:00:00.000Z",
        completedAt: "2026-10-01T12:02:00.000Z",
        status: "failed",
        lastGoodSnapshotRetrievedAt: lastSuccessAt,
        failures: [{
          sourceId: "bonap-napa",
          stage: "bonap-napa",
          message: "FullTaxonList was incomplete",
        }],
        sources: {
          "usda-plants": { status: "not_published", lastSuccessAt },
          "bonap-napa": { status: "failed", lastSuccessAt },
          npin: { status: "not_started", lastSuccessAt },
        },
      },
    });
    expect(report.sourceDiscovery.bonap).toMatchObject({
      status: "failed_stale",
      retrievedAt: lastSuccessAt,
      lastSuccessAt,
      lastAttemptStatus: "failed",
    });
    expect(report.sourceDiscovery.npin).toMatchObject({
      status: "not_attempted_stale",
      lastSuccessAt,
      lastAttemptStatus: "not_started",
    });
    expect(report.refreshRun.failures[0]).toMatchObject({
      sourceId: "bonap-napa",
      message: "FullTaxonList was incomplete",
    });
  });

  it("reports complete affirmative coverage only when every county intersection is supported", () => {
    const evidence = [
      affirmativeRecord,
      { ...affirmativeRecord, countyFips: "27123" },
    ];
    const report = buildNativeCoverageReport({
      countyData: {
        zips: { "55423": "27053" },
        intersections: {
          "55423": [
            { fips: "27053", stateFips: "27" },
            { fips: "27123", stateFips: "27" },
          ],
        },
        counties: {
          "27053": { name: "Hennepin", state: "MN" },
          "27123": { name: "Ramsey", state: "MN" },
        },
      },
      ecoregionData: { names: { "51": "Northern Glaciated Plains" }, zips: { "55423": "51" } },
      ecoregionPlants: { ecoregions: { "51": { plantIds: ["echinacea-purpurea"] } } },
      plants: { "echinacea-purpurea": {} },
      sources: {
        "usda-plants": {
          authority: "USDA PLANTS",
          rangeEvidenceAvailable: true,
          licenseNote: "Freely reusable with citation.",
        },
      },
      rangeEvidence: evidence,
    });
    expect(report.localRangeEvidence).toMatchObject({
      catalogMappedZctasWithAnyCountyEvidence: 1,
      catalogMappedZctasWithCompleteAffirmativeCoverage: 1,
      catalogMappedZctasWithAffirmativeEvidence: 1,
    });
  });

  it("reports BONAP presence, NPIN enrichment, raw map categories, and nativity as separate coverage", () => {
    const bonapSource = {
      authority: "Biota of North America Program (BONAP)",
      rangeEvidenceAvailable: true,
      licenseNote: "BONAP facts may be reused with permission and citation.",
      ownerAuthorizationNote: "Project owner confirms advance written permission.",
      sourceTermsStatus: "verified",
    };
    const record = (countyFips, rawCategory, nativityStatus) => ({
      ...affirmativeRecord,
      sourceId: "bonap-napa",
      sourceCitation: `BONAP county category ${rawCategory}.`,
      sourceUrl: "https://bonap.net/MapGallery/County/Echinacea%20purpurea.png",
      releaseOrObservationDate: "2014-12-14",
      retrievedAt: "2026-10-01T12:00:00.000Z",
      countyFips,
      nativityStatus,
      bonapReview: {
        mapSha256: "a".repeat(64),
        mapKeyUrl: "http://bonap.org/MapKey.html",
        mapGenerationDate: "2014-12-14",
        mapGenerationDateSource: "visual_map_content",
        etag: '"map"',
        lastModified: "Fri, 19 May 2017 00:00:00 GMT",
        rawCategory,
        taxonomyMatch: "exact",
        mapScopeDecision: "confirmed_taxon_scope",
        reviewStatus: "approved",
        currentStatusConfirmed: true,
        reviewer: "native-data-reviewer",
        reviewedAt: "2026-10-01T12:00:00.000Z",
        reviewNote: "Reviewed image and MapKey.",
      },
    });
    const report = buildNativeCoverageReport({
      countyData: {
        zips: { "55423": "27053" },
        intersections: {
          "55423": [
            { fips: "27053", stateFips: "27" },
            { fips: "27123", stateFips: "27" },
          ],
        },
        counties: {
          "27053": { name: "Hennepin", state: "MN" },
          "27123": { name: "Ramsey", state: "MN" },
        },
      },
      ecoregionData: { names: { "51": "Northern Glaciated Plains" }, zips: { "55423": "51" } },
      ecoregionPlants: { ecoregions: { "51": { plantIds: ["echinacea-purpurea"] } } },
      plants: { "echinacea-purpurea": {} },
      sources: { "bonap-napa": bonapSource, npin: { authority: "NPIN", rangeEvidenceAvailable: false } },
      rangeEvidence: [record("27053", "Native", "native"), record("27123", "Native", "native")],
      sourceIngestion: {
        retrievedAt: "2026-10-01T12:00:00.000Z",
        bonap: {
          retrievedAt: "2026-10-01T12:00:00.000Z",
          fullTaxonList: { taxonCount: 5000 },
          taxonMatches: [{ plantId: "echinacea-purpurea", matchStatus: "exact" }],
          countyOccurrences: [
            { countyFips: "27053", occurrenceTaxonCount: 1853, speciesAndNothospeciesTaxonCount: 1479, infraspecificTaxonCount: 374, reportedSpeciesAndNothospeciesCount: 1479, candidateTaxa: [{ plantId: "echinacea-purpurea" }] },
            { countyFips: "27123", occurrenceTaxonCount: 1020, speciesAndNothospeciesTaxonCount: 1020, infraspecificTaxonCount: 0, reportedSpeciesAndNothospeciesCount: 1020, candidateTaxa: [{ plantId: "echinacea-purpurea" }] },
          ],
          taxonDetails: [{ bonapTaxonId: "1234" }],
          mapMappings: [{ plantId: "echinacea-purpurea", mapStatus: "exact" }],
          mapSnapshots: [{
            mapUrl: "https://bonap.net/MapGallery/County/Echinacea%20purpurea.png",
            sha256: "a".repeat(64),
            retrievedAt: "2026-10-01T12:00:00.000Z",
            etag: '"map"',
            lastModified: "Fri, 19 May 2017 00:00:00 GMT",
            mapGenerationDate: "2014-12-14",
            mapGenerationDateSource: "png_content_metadata",
            mapKeyUrl: "http://bonap.org/MapKey.html",
          }],
        },
        npin: {
          retrievedAt: "2026-10-01T12:00:00.000Z",
          enrichments: [{
            plantId: "echinacea-purpurea",
            matchStatus: "exact",
            profileStatus: "available",
            fields: { distribution: "IL, MN, WI" },
            nativityResolution: "none",
          }],
        },
      },
      bonapMapReviews: {
        mapKeyUrl: "http://bonap.org/MapKey.html",
        records: [{
          plantId: "echinacea-purpurea",
          scientificName: "Echinacea purpurea",
          mapUrl: "https://bonap.net/MapGallery/County/Echinacea%20purpurea.png",
          mapSha256: "a".repeat(64),
          reviewStatus: "approved",
          taxonomyMatch: "exact",
          mapScopeDecision: "confirmed_taxon_scope",
          mapGenerationDateFromContent: "2014-12-14",
          currentStatusConfirmed: true,
          reviewer: "native-data-reviewer",
          reviewedAt: "2026-10-01T12:00:00.000Z",
          reviewNote: "Reviewed image and MapKey.",
          counties: [
            { countyFips: "27053", rawCategory: "Native" },
            { countyFips: "27123", rawCategory: "Native" },
          ],
        }],
      },
    });

    expect(report.sourceDiscovery.bonap).toMatchObject({
      fullTaxonListTaxonCount: 5000,
      exactCatalogTaxonMatchCount: 1,
      tdcOccurrenceCountyCount: 2,
      tdcOccurrenceTaxonCount: 2873,
      tdcSpeciesAndNothospeciesTaxonCount: 2499,
      tdcInfraspecificTaxonCount: 374,
      catalogTaxonPresenceRecordCount: 2,
      napaMapTaxonCount: 1,
      reviewedCountyConversionCount: 2,
      approvedReviewedMapCount: 1,
      staleReviewMapCount: 0,
      mapsAwaitingCountyReviewCount: 0,
      mapScopeReviewCounts: {
        confirmedTaxonScopeCount: 1,
        mayConflateInfraspecificCount: 0,
        unresolvedScopeCount: 0,
      },
      observedRawCategoryCounts: [{ category: "Native", count: 2 }],
      lower48StateCoverage: expect.arrayContaining([
        expect.objectContaining({ stateCode: "MN", tdcOccurrenceCountyFipsCount: 2 }),
      ]),
      mapSnapshots: [{
        mapUrl: "https://bonap.net/MapGallery/County/Echinacea%20purpurea.png",
        mapSha256: "a".repeat(64),
        retrievedAt: "2026-10-01T12:00:00.000Z",
        etag: '"map"',
        lastModified: "Fri, 19 May 2017 00:00:00 GMT",
        mapGenerationDate: "2014-12-14",
        mapGenerationDateSource: "visual_map_content",
        mapKeyUrl: "http://bonap.org/MapKey.html",
        reviewStatus: "approved",
        taxonomyMatch: "exact",
        mapScopeDecision: "confirmed_taxon_scope",
        currentStatusConfirmed: true,
      }],
    });
    expect(report.sourceDiscovery.npin).toMatchObject({
      autocompleteTaxonMatchCount: 1,
      availableProfileCount: 1,
      profileFieldEnrichmentCount: 1,
      nativityEvidenceRecordCount: 0,
    });
    expect(report.localRangeEvidence).toMatchObject({
      recordCount: 2,
      catalogMappedZctasWithCompleteAffirmativeCoverage: 1,
    });
  });

  it("keeps TDC occurrence and NPIN geography from creating any affirmative ZCTA coverage", () => {
    const report = buildNativeCoverageReport({
      countyData: {
        zips: { "55423": "27053" },
        counties: { "27053": { name: "Hennepin", state: "MN" } },
      },
      ecoregionData: { names: { "51": "Northern Glaciated Plains" }, zips: { "55423": "51" } },
      ecoregionPlants: { ecoregions: { "51": { plantIds: ["echinacea-purpurea"] } } },
      plants: { "echinacea-purpurea": {} },
      sources: {
        "bonap-napa": { authority: "BONAP", rangeEvidenceAvailable: true },
        npin: { authority: "NPIN", rangeEvidenceAvailable: false },
      },
      rangeEvidence: [],
      sourceIngestion: {
        retrievedAt: "2026-10-01T12:00:00.000Z",
        bonap: {
          retrievedAt: "2026-10-01T12:00:00.000Z",
          fullTaxonList: { taxonCount: 1000 },
          taxonMatches: [{ plantId: "echinacea-purpurea", matchStatus: "exact" }],
          countyOccurrences: [{ countyFips: "27053", occurrenceTaxonCount: 1479, candidateTaxa: [{ plantId: "echinacea-purpurea" }] }],
          taxonDetails: [{ bonapTaxonId: "1234", continentalNativity: true }],
          mapMappings: [],
          mapSnapshots: [],
        },
        npin: {
          retrievedAt: "2026-10-01T12:00:00.000Z",
          enrichments: [{ plantId: "echinacea-purpurea", matchStatus: "exact", profileStatus: "available", fields: { distribution: "MN" } }],
        },
      },
    });
    expect(report.sourceDiscovery.bonap.tdcOccurrenceTaxonCount).toBe(1479);
    expect(report.sourceDiscovery.npin.availableProfileCount).toBe(1);
    expect(report.localRangeEvidence.catalogMappedZctasWithCompleteAffirmativeCoverage).toBe(0);
  });
});
