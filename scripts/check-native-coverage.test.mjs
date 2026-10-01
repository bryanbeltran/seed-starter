import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildNativeCoverageReport } from "./check-native-coverage.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

function reportWithEvidence(rangeEvidence) {
  return buildNativeCoverageReport({
    countyData: {
      zips: { "55423": "27053" },
      counties: { "27053": { name: "Hennepin", state: "MN" } },
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
    },
    rangeEvidence,
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
      catalogMappedZctasWithAffirmativeEvidence: 0,
      catalogMappedZctasWithNotNativeEvidence: 0,
      catalogMappedZctasWithoutLocalEvidence: 3168,
    });
    expect(report.states).toHaveLength(48);
    expect(report.states.map((state) => state.state)).toContain("California");
    expect(report.states.every((state) => "gaps" in state)).toBe(true);
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
      rangeEvidenceAvailable: false,
    });
    expect(sources["bonap-napa"].citation).toContain(
      "https://bonap.net/TDC/Query/SpeciesList",
    );
    expect(sources["bonap-napa"].uncertainty).toContain(
      "Only a taxonomy-matched county category exactly Native may support affirmative nativity",
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
    expect(bonap.lower48StateCoverage).toContainEqual({
      stateCode: "MN",
      state: "Minnesota",
      stateFips: "27",
      countyOrFinerRecordCount: 1,
      countyFipsCount: 1,
    });
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

  it("counts local evidence from any Census county intersecting a ZCTA", () => {
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
      catalogMappedZctasWithAffirmativeEvidence: 1,
      catalogMappedZctasWithoutLocalEvidence: 0,
    });
  });
});
