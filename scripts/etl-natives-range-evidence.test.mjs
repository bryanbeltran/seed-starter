import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPlantRangeEvidence,
  commitNativeEvidenceSnapshotAtomically,
  commitRangeEvidenceAtomically,
  countyCodeFromSymbol,
  discoverRangeEvidenceChanges,
  fetchRangeEvidence,
  fetchSupplementalSourceData,
  fetchCountyFipsIndex,
  lower48CountyFipses,
  indexDistributionFips,
  parseDistributionDocumentation,
  PLANTS_API,
  COUNTY_BOUNDARIES_URL,
  COUNTY_LAYER_URL,
  validateSourceIngestionSnapshot,
  validateBonapCountyMapReviewFile,
  validateRangeEvidenceFile,
} from "./etl-natives-range-evidence.mjs";
import {
  BONAP_FULL_TAXON_LIST_VERIFIED_BYTES,
  BONAP_URLS,
  buildBonapCountyEvidence,
} from "./lib/bonap-native-source.mjs";
import {
  createNativeRefreshStatus,
  failNativeRefreshStatus,
} from "./lib/native-refresh-status.mjs";

const source = {
  authority: "USDA PLANTS",
  licenseNote: "PLANTS information may be used with citation.",
  rangeEvidenceAvailable: true,
};
const plant = {
  id: "echinacea-purpurea",
  scientificName: "Echinacea purpurea",
};
const fullTaxonListFixture = () => ({
  taxonCount: 1,
  taxa: [{ family: "Asteraceae", genus: "Echinacea", scientificName: "Echinacea purpurea" }],
  url: "https://bonap.net/TDC/Query/FullTaxonList",
  completenessCheck: "verified_response_bytes_and_strict_tsv_v1",
  verifiedResponseBytes: BONAP_FULL_TAXON_LIST_VERIFIED_BYTES,
  responseBytes: BONAP_FULL_TAXON_LIST_VERIFIED_BYTES,
  sha256: "f".repeat(64),
  contentLength: null,
  etag: null,
  lastModified: null,
});
const profile = {
  Id: 34475,
  Symbol: "ECPU",
  NativeStatuses: [{ Region: "L48", Status: "N", Type: "Native" }],
};
const distributionCsv = [
  "Distribution Data",
  "Symbol,Country,State,State FIP,County,County FIP",
  "ECPU,United States,New York,36,Albany,001",
].join("\n");
const feature = (symbol = "Native", nativityId = "5") => ({
  attributes: {
    plant_master_id: 34475,
    plant_nativity_id: nativityId,
    country_subdivision_id: 1875,
    country_subdivision_name: "Albany",
    Symbol: symbol,
  },
});
const retrievedAt = "2026-10-01T12:00:00.000Z";
const bonapSource = {
  authority: "Biota of North America Program (BONAP)",
  licenseNote: "BONAP facts may be reproduced with permission and citation.",
  ownerAuthorizationNote: "Written permission to bundle BONAP data is confirmed.",
  sourceTermsStatus: "verified",
  rangeEvidenceAvailable: true,
};
const finerSource = {
  authority: "Example Botanical Atlas",
  url: "https://flora.example/range-data",
  licenseNote: "Reuse with attribution.",
  sourceTermsStatus: "verified",
  verifiedFinerAreaGeographies: ["census-zcta-2010"],
  rangeEvidenceAvailable: true,
};

const tempDirectories = [];
afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("USDA PLANTS range-evidence ingestion", () => {
  it("parses the distribution CSV's state and county FIPS fields", () => {
    expect(parseDistributionDocumentation(distributionCsv)).toContainEqual({
      Symbol: "ECPU",
      Country: "United States",
      State: "New York",
      "State FIP": "36",
      County: "Albany",
      "County FIP": "001",
    });
  });

  it("crosswalks only unique county names to the USDA Distribution Documentation FIPS", () => {
    const rows = parseDistributionDocumentation([
      "Distribution Data",
      "Symbol,Country,State,State FIP,County,County FIP",
      "ECPU,United States,Alabama,01,Bibb,007",
      "ECPU,United States,New York,36,Albany,001",
      "ECPU,United States,Indiana,18,Washington,175",
      "ECPU,United States,Alabama,01,Washington,129",
    ].join("\n"));
    const index = indexDistributionFips(rows);

    expect(index.get("bibb")).toEqual({
      stateName: "Alabama",
      countyName: "Bibb",
      fips: "01007",
    });
    expect(index.get("albany")).toEqual({
      stateName: "New York",
      countyName: "Albany",
      fips: "36001",
    });
    expect(index.get("washington")).toBeNull();
  });

  it("does not map a lower-48 county name when another US county has the same name", () => {
    const index = indexDistributionFips(
      [
        {
          Country: "United States",
          State: "New York",
          "State FIP": "36",
          County: "Albany",
          "County FIP": "001",
        },
        {
          Country: "United States",
          State: "Alaska",
          "State FIP": "02",
          County: "Albany",
          "County FIP": "005",
        },
      ],
      [{ name: "New York", fips: "36" }],
    );

    expect(index.get("albany")).toBeNull();
  });

  it("loads the official USDA county-boundary ID to FIPS crosswalk", async () => {
    const requests = [];
    const index = await fetchCountyFipsIndex({
      fetchImpl: async (input) => {
        const url = new URL(input);
        requests.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            features: [{
              attributes: {
                plant_location_id: 1875,
                country_subdivision_code: "36001",
                country_subdivision_name: "Albany",
              },
            }],
            exceededTransferLimit: false,
          }),
        };
      },
    });

    expect(index.byName.get("albany")[0]).toMatchObject({
      countyName: "Albany",
      fips: "36001",
      knownOutsideLower48: false,
    });
    expect(requests[0].href).toContain(`${COUNTY_BOUNDARIES_URL}/query`);
    expect(requests[0].searchParams.get("outFields")).toContain("country_subdivision_code");
  });

  it("identifies a unique county outside the lower 48 so it is not imported as an unknown gap", () => {
    const alaskaDistribution = [
      "Distribution Data",
      "Symbol,Country,State,State FIP,County,County FIP",
      "ECPU,United States,Alaska,02,Nome,180",
    ].join("\n");
    const records = buildPlantRangeEvidence({
      plant,
      masterId: 34475,
      distributionCsv: alaskaDistribution,
      countyFeatures: [
        {
          attributes: {
            ...feature().attributes,
            country_subdivision_id: 2999,
            country_subdivision_name: "Nome",
          },
        },
      ],
      source,
      retrievedAt,
    });

    expect(records).toEqual([]);
  });

  it("uses county Symbol labels and does not infer meanings from numeric nativity IDs", () => {
    expect(countyCodeFromSymbol("Native", "unverified-id")).toBe("native");
    expect(countyCodeFromSymbol("Introduced", "unverified-id")).toBe("not_native");
    expect(countyCodeFromSymbol("Both", "unverified-id")).toBe("unknown");
    expect(countyCodeFromSymbol("Excluded", "unverified-id")).toBe("unknown");
    expect(countyCodeFromSymbol("Unknown", "unverified-id")).toBe("unknown");
    expect(() => countyCodeFromSymbol("Native-ish", "5")).toThrow(/Unrecognized/);
  });

  it("joins county status to exact state/county FIPS and records provenance", () => {
    const records = buildPlantRangeEvidence({
      plant,
      masterId: 34475,
      profile,
      distributionCsv,
      countyFeatures: [feature()],
      source,
      retrievedAt,
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      sourceId: "usda-plants",
      sourceUrl: "https://apps.geo.fpac.usda.gov/nrcs-geodata/rest/services/land_use_land_cover/plants/MapServer/6",
      releaseOrObservationDate: null,
      retrievedAt,
      spatialResolution: "county",
      countyFips: "36001",
      nativityStatus: "native",
      uncertainty: expect.stringContaining("numeric code is not interpreted"),
    });
    expect(records[0].sourceCitation).toContain("plant_nativity_id \"5\"");
    expect(records[0].sourceCitation).toContain("Distribution Documentation county FIPS 36001");
    expect(records[0].licenseNote).toBe(source.licenseNote);
  });

  it("keeps unresolved FIPS and ambiguous statuses non-affirmative", () => {
    const unresolved = buildPlantRangeEvidence({
      plant,
      masterId: 34475,
      profile,
      distributionCsv: "Distribution Data\nSymbol,Country,State,State FIP,County,County FIP\nECPU,United States,New York,36,,",
      countyFeatures: [feature("Both", "3,5")],
      source,
      retrievedAt,
    });

    expect(unresolved[0]).toMatchObject({
      countyFips: null,
      nativityStatus: "unknown",
      spatialResolution: "county",
    });
    expect(unresolved[0].uncertainty).toContain("no unique lower-48 county FIPS");
  });

  it("preserves county-layer records with no USDA county ID crosswalk as unresolved", () => {
    const unresolved = buildPlantRangeEvidence({
      plant,
      masterId: 34475,
      profile,
      distributionCsv,
      countyFeatures: [
        {
          attributes: {
            ...feature().attributes,
            country_subdivision_id: 9999,
            country_subdivision_name: "Example Parish",
          },
        },
      ],
      source,
      retrievedAt,
    });

    expect(unresolved[0]).toMatchObject({
      countyFips: null,
      nativityStatus: "unknown",
      spatialResolution: "county",
      geographicScope: expect.stringContaining("state and county FIPS unknown"),
    });
    expect(unresolved[0].uncertainty).toContain("cannot match a ZIP county");
  });

  it("uses the official county ID crosswalk when county names are ambiguous", () => {
    const ambiguousDistribution = [
      "Distribution Data",
      "Symbol,Country,State,State FIP,County,County FIP",
      "ECPU,United States,New York,36,Albany,001",
      "ECPU,United States,Georgia,13,Albany,001",
    ].join("\n");
    const countyFipsBySubdivisionId = new Map([
      [1875, { countyName: "Albany", fips: "36001", knownOutsideLower48: false }],
    ]);
    const records = buildPlantRangeEvidence({
      plant,
      masterId: 34475,
      distributionCsv: ambiguousDistribution,
      countyFeatures: [feature()],
      countyFipsBySubdivisionId,
      source,
      retrievedAt,
    });

    expect(records[0]).toMatchObject({ countyFips: "36001", nativityStatus: "native" });
  });

  it("does not use a regional profile status to replace county-level Symbol evidence", () => {
    const records = buildPlantRangeEvidence({
      plant,
      masterId: 34475,
      profile: {
        ...profile,
        NativeStatuses: [{ Region: "L48", Status: "I", Type: "Introduced" }],
      },
      distributionCsv,
      countyFeatures: [feature("Native", "5")],
      source,
      retrievedAt,
    });

    expect(records[0]).toMatchObject({ nativityStatus: "native", countyFips: "36001" });
    expect(records[0].uncertainty).toContain("nativity_id");
  });

  it("rejects county-layer features for a different USDA plant master ID", () => {
    expect(() =>
      buildPlantRangeEvidence({
        plant,
        masterId: 34475,
        distributionCsv,
        countyFeatures: [
          {
            attributes: { ...feature().attributes, plant_master_id: 99999 },
          },
        ],
        source,
        retrievedAt,
      }),
    ).toThrow(/different plant master ID/);
  });

  it("resolves taxa and requests distribution documentation and county features by master ID", async () => {
    const requests = [];
    const fetchImpl = async (input, options = {}) => {
      const url = new URL(input);
      requests.push({ url, options });
      const json = (value) => ({
        ok: true,
        status: 200,
        json: async () => value,
        text: async () => "",
      });
      const text = (value) => ({
        ok: true,
        status: 200,
        json: async () => null,
        text: async () => value,
      });

      if (url.href.startsWith(`${PLANTS_API}/PlantSearch`)) {
        return json([{ Plant: { Symbol: "ECPU", Id: 34475 } }]);
      }
      if (url.href === `${PLANTS_API}/PlantProfile/getDownloadDistributionDocumentation`) {
        return text(distributionCsv);
      }
      if (url.href.startsWith(`${PLANTS_API}/PlantProfile`)) {
        return json({ Id: 34475, Symbol: "ECPU" });
      }
      if (url.href.startsWith(`${COUNTY_LAYER_URL}/query`)) {
        return json({ features: [feature()], exceededTransferLimit: false });
      }
      throw new Error(`Unexpected USDA request ${url}`);
    };

    const payload = await fetchRangeEvidence({
      plants: {
        [plant.id]: {
          ...plant,
          sourceUrl: "https://plants.usda.gov/plant-profile?symbol=ECPU",
        },
      },
      sources: { "usda-plants": source },
      fetchImpl,
      now: new Date(retrievedAt),
    });

    const distributionRequest = requests.find(({ url }) =>
      url.href.endsWith("/getDownloadDistributionDocumentation"),
    );
    expect(distributionRequest?.options.method).toBe("POST");
    expect(JSON.parse(distributionRequest.options.body)).toEqual({ masterId: 34475 });
    expect(
      requests.some(({ url }) => url.href.startsWith(`${PLANTS_API}/PlantSearch?searchText=ECPU`)),
    ).toBe(true);
    expect(
      requests.some(({ url }) => url.href.startsWith(`${PLANTS_API}/PlantProfile?symbol=ECPU`)),
    ).toBe(true);
    expect(payload.records).toHaveLength(1);
    expect(payload.records[0]).toMatchObject({ countyFips: "36001", nativityStatus: "native" });
  });

  it("discovers changed county claims without treating retrieval-time changes as source changes", () => {
    const previous = {
      records: [{ plantId: "a", countyFips: "27053", geographicScope: "Hennepin, MN", nativityStatus: "native", retrievedAt: "old" }],
    };
    const next = {
      records: [{ plantId: "a", countyFips: "27053", geographicScope: "Hennepin, MN", nativityStatus: "native", retrievedAt: "new" }],
    };
    expect(discoverRangeEvidenceChanges(previous, next)).toEqual({
      added: 0,
      removed: 0,
      changed: 0,
      current: 1,
    });
    expect(
      discoverRangeEvidenceChanges(previous, {
        records: [{ ...next.records[0], nativityStatus: "not_native" }],
      }).changed,
    ).toBe(1);
  });

  it("keeps the last-good file untouched when staged evidence is invalid", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "native-evidence-test-"));
    tempDirectories.push(directory);
    const outputPath = path.join(directory, "plant-range-evidence.json");
    const good = {
      version: "good",
      provenance: "last validated data",
      records: [
        buildPlantRangeEvidence({
          plant,
          masterId: 34475,
          profile,
          distributionCsv,
          countyFeatures: [feature()],
          source,
          retrievedAt,
        })[0],
      ],
    };
    const validation = {
      plantIds: [plant.id],
      sources: { "usda-plants": source },
    };
    commitRangeEvidenceAtomically(outputPath, good, validation);
    const lastGood = fs.readFileSync(outputPath, "utf8");

    const invalid = {
      ...good,
      version: "bad",
      records: [{ ...good.records[0], sourceUrl: "https://example.org/range.csv" }],
    };
    expect(() => commitRangeEvidenceAtomically(outputPath, invalid, validation)).toThrow(
      /not an official USDA HTTPS URL/,
    );
    expect(fs.readFileSync(outputPath, "utf8")).toBe(lastGood);
    expect(fs.existsSync(`${outputPath}.staged`)).toBe(false);
  });

  it("preserves the last-good file when a refresh returns no range records", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "native-evidence-empty-test-"));
    tempDirectories.push(directory);
    const outputPath = path.join(directory, "plant-range-evidence.json");
    const good = {
      version: "good",
      provenance: "last validated data",
      records: [
        buildPlantRangeEvidence({
          plant,
          masterId: 34475,
          profile,
          distributionCsv,
          countyFeatures: [feature()],
          source,
          retrievedAt,
        })[0],
      ],
    };
    const validation = {
      plantIds: [plant.id],
      sources: { "usda-plants": source },
    };
    commitRangeEvidenceAtomically(outputPath, good, validation);
    const lastGood = fs.readFileSync(outputPath, "utf8");

    expect(() => commitRangeEvidenceAtomically(
      outputPath,
      { ...good, records: [] },
      validation,
    )).toThrow(/has no records/);
    expect(fs.readFileSync(outputPath, "utf8")).toBe(lastGood);
    expect(fs.existsSync(`${outputPath}.staged`)).toBe(false);
  });

  it("validates BONAP only with exact map, MapKey, taxonomy, and review provenance", () => {
    const sourceUrl = "https://bonap.net/MapGallery/County/Echinacea%20purpurea.png";
    const record = {
      plantId: plant.id,
      sourceId: "bonap-napa",
      sourceCitation: "BONAP NAPA county map; raw county category Native.",
      sourceUrl,
      releaseOrObservationDate: "2014-12-14",
      retrievedAt,
      licenseNote: bonapSource.licenseNote,
      geographicScope: "County FIPS 27053.",
      spatialResolution: "county",
      countyFips: "27053",
      nativityStatus: "native",
      uncertainty: null,
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
        reviewedAt: retrievedAt,
        reviewNote: "Reviewed against image and MapKey.",
      },
    };
    const payload = { version: "test", provenance: "fixture", records: [record] };
    const sources = { "bonap-napa": bonapSource };
    const currentMapSnapshots = [{
      mapUrl: sourceUrl,
      sha256: "a".repeat(64),
      mapKeyUrl: "http://bonap.org/MapKey.html",
      retrievedAt,
      etag: '"d5988b42bfd0d21:0"',
      lastModified: "Fri, 19 May 2017 00:00:00 GMT",
      mapGenerationDate: "2014-12-14",
      mapGenerationDateSource: "png_content_metadata",
    }];
    const approvedReview = {
      plantId: plant.id,
      scientificName: plant.scientificName,
      mapUrl: sourceUrl,
      mapSha256: "a".repeat(64),
      mapGenerationDateFromContent: "2014-12-14",
      taxonomyMatch: "exact",
      mapScopeDecision: "confirmed_taxon_scope",
      reviewStatus: "approved",
      currentStatusConfirmed: true,
      reviewer: "native-data-reviewer",
      reviewedAt: retrievedAt,
      reviewNote: "Reviewed against image and MapKey.",
      counties: [{ countyFips: "27053", rawCategory: "Native" }],
    };
    const validation = {
      plantIds: [plant.id],
      sources,
      bonapMapSnapshots: currentMapSnapshots,
      bonapReviewRecords: [approvedReview],
    };
    expect(validateRangeEvidenceFile(payload, {
      ...validation,
    })).toBe(payload);
    expect(() => validateRangeEvidenceFile({
      ...payload,
      records: [{
        ...record,
        releaseOrObservationDate: "2017-05-19",
        bonapReview: { ...record.bonapReview, mapGenerationDate: "2017-05-19" },
      }],
    }, validation)).toThrow(/does not match its approved map review conversion/);
    expect(() => validateRangeEvidenceFile({
      ...payload,
      records: [{
        ...record,
        bonapReview: { ...record.bonapReview, lastModified: "Fri, 20 May 2017 00:00:00 GMT" },
      }],
    }, validation)).toThrow(/does not match its approved map review conversion/);
    expect(() => validateRangeEvidenceFile({
      ...payload,
      records: [{ ...record, countyFips: "27123" }],
    }, validation)).toThrow(/does not match its approved map review conversion/);
    expect(() => validateRangeEvidenceFile({
      ...payload,
      records: [{ ...record, bonapReview: { ...record.bonapReview, rawCategory: "Native Historic" } }],
    }, validation)).toThrow(/does not match its approved map review conversion/);
    expect(() => validateRangeEvidenceFile(payload, {
      ...validation,
      bonapMapSnapshots: [{ ...currentMapSnapshots[0], sha256: "b".repeat(64) }],
    })).toThrow(/does not match its approved map review conversion/);
    expect(() => validateRangeEvidenceFile({
      ...payload,
      records: [{ ...record, bonapReview: { ...record.bonapReview, taxonomyMatch: "ambiguous" } }],
    }, validation)).toThrow(/does not match its approved map review conversion/);
    const historicReview = {
      ...approvedReview,
      counties: [{ countyFips: "27053", rawCategory: "Native Historic" }],
    };
    expect(validateRangeEvidenceFile({
      ...payload,
      records: [{
        ...record,
        nativityStatus: "not_native",
        bonapReview: { ...record.bonapReview, rawCategory: "Native Historic" },
      }],
    }, {
      ...validation,
      bonapReviewRecords: [historicReview],
    })).toBeTruthy();
    const scopeUnresolvedRecord = {
      ...record,
      nativityStatus: "unknown",
      uncertainty: "Map may conflate infraspecific taxa.",
      bonapReview: {
        ...record.bonapReview,
        mapScopeDecision: "may_conflate_infraspecific",
      },
    };
    expect(validateRangeEvidenceFile({
      ...payload,
      records: [scopeUnresolvedRecord],
    }, {
      ...validation,
      bonapReviewRecords: [{ ...approvedReview, mapScopeDecision: "may_conflate_infraspecific" }],
    })).toBeTruthy();
    expect(() => validateRangeEvidenceFile({
      ...payload,
      records: [{ ...scopeUnresolvedRecord, nativityStatus: "native" }],
    }, {
      ...validation,
      bonapReviewRecords: [{ ...approvedReview, mapScopeDecision: "may_conflate_infraspecific" }],
    })).toThrow(/does not match its approved map review conversion/);
  });

  it("validates finer claims only when their whole-ZCTA footprint and source capability are recorded", () => {
    const record = {
      plantId: plant.id,
      sourceId: "example-atlas",
      sourceCitation: "Example Botanical Atlas ZCTA range record.",
      sourceUrl: "https://flora.example/range-data/echinacea-purpurea",
      releaseOrObservationDate: null,
      retrievedAt,
      licenseNote: finerSource.licenseNote,
      geographicScope: "Census 2010 ZCTA 55401.",
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55401" },
      nativityStatus: "native",
      uncertainty: null,
    };
    const payload = { version: "test", provenance: "fixture", records: [record] };

    expect(validateRangeEvidenceFile(payload, {
      plantIds: [plant.id],
      sources: { "example-atlas": finerSource },
    })).toBe(payload);
    expect(() => validateRangeEvidenceFile({
      ...payload,
      records: [{ ...record, finerArea: undefined }],
    }, {
      plantIds: [plant.id],
      sources: { "example-atlas": finerSource },
    })).toThrow(/finer evidence is not tied to a verified ZCTA-capable source/);
    expect(() => validateRangeEvidenceFile(payload, {
      plantIds: [plant.id],
      sources: { "example-atlas": { ...finerSource, verifiedFinerAreaGeographies: [] } },
    })).toThrow(/finer evidence is not tied to a verified ZCTA-capable source/);
  });

  it("validates manual BONAP county conversions against the live taxon map and lower-48 FIPS", () => {
    const reviewFile = {
      version: "2",
      mapKeyUrl: "http://bonap.org/MapKey.html",
      provenance: "Reviewed image content and map legend.",
      records: [{
        plantId: plant.id,
        scientificName: plant.scientificName,
        mapUrl: "https://bonap.net/MapGallery/County/Echinacea%20purpurea.png",
        mapSha256: "a".repeat(64),
        mapGenerationDateFromContent: "2014-12-14",
        taxonomyMatch: "exact",
        mapScopeDecision: "confirmed_taxon_scope",
        reviewStatus: "approved",
        currentStatusConfirmed: true,
        reviewer: "native-data-reviewer",
        reviewedAt: retrievedAt,
        reviewNote: "Read the date in the map image and checked categories against the MapKey.",
        counties: [{ countyFips: "27053", rawCategory: "Native" }],
      }],
    };
    expect(validateBonapCountyMapReviewFile(reviewFile, { [plant.id]: plant })).toBe(reviewFile);
    expect(() => validateBonapCountyMapReviewFile({
      ...reviewFile,
      records: [{ ...reviewFile.records[0], mapScopeDecision: undefined }],
    }, { [plant.id]: plant })).toThrow(/map scope/);
    expect(() => validateBonapCountyMapReviewFile({
      ...reviewFile,
      records: [{ ...reviewFile.records[0], mapUrl: "https://bonap.net/MapGallery/County/Genus/Echinacea.png" }],
    }, { [plant.id]: plant })).toThrow(/linked BONAP per-taxon county PNG/);
    expect(() => validateBonapCountyMapReviewFile({
      ...reviewFile,
      records: [{ ...reviewFile.records[0], counties: [{ countyFips: "02013", rawCategory: "Native" }] }],
    }, { [plant.id]: plant })).toThrow(/unique lower-48 FIPS/);
    expect(() => validateBonapCountyMapReviewFile({
      ...reviewFile,
      records: [{ ...reviewFile.records[0], counties: [{ countyFips: "01000", rawCategory: "Native" }] }],
    }, { [plant.id]: plant })).toThrow(/canonical Census county set/);
  });

  it("validates complete supplemental snapshots against every lower-48 county", () => {
    const counties = [{ fips: "27053" }, { fips: "27123" }];
    expect(lower48CountyFipses({ intersections: { "55423": counties } })).toEqual([
      "27053",
      "27123",
    ]);
    expect(lower48CountyFipses({ zips: { "55423": "27053" } })).toEqual([]);
    const snapshot = {
      version: "1",
      retrievedAt,
      provenance: "fixture snapshot",
      bonap: {
        sourceId: "bonap-napa",
        retrievedAt,
        fullTaxonList: fullTaxonListFixture(),
        taxonMatches: [{ plantId: plant.id, scientificName: plant.scientificName, matchStatus: "unresolved", bonapScientificName: null }],
        countyOccurrences: counties.map(({ fips }) => ({
          countyFips: fips,
          occurrenceTaxonCount: 0,
          speciesAndNothospeciesTaxonCount: 0,
          infraspecificTaxonCount: 0,
          reportedSpeciesAndNothospeciesCount: 0,
          pageCount: 1,
          pageUpdateMarkers: [{ page: "-1", etag: null, lastModified: null }],
          candidateTaxa: [],
          evidenceUse: "presence_only",
          retrievedAt,
        })),
        taxonDetails: [],
        mapMappings: [],
        mapSnapshots: [],
        reviewedMapRecordCount: 0,
      },
      npin: { sourceId: "npin", retrievedAt, enrichments: [{ plantId: plant.id, matchStatus: "unresolved", profileStatus: "not_attempted", nativityResolution: "none" }] },
    };
    const validation = { countyFipses: ["27053", "27123"], plantIds: [plant.id] };
    expect(validateSourceIngestionSnapshot(snapshot, validation)).toBe(snapshot);
    expect(() => validateSourceIngestionSnapshot({
      ...snapshot,
      bonap: {
        ...snapshot.bonap,
        fullTaxonList: {
          ...snapshot.bonap.fullTaxonList,
          responseBytes: BONAP_FULL_TAXON_LIST_VERIFIED_BYTES - 1,
        },
      },
    }, validation)).toThrow(/FullTaxonList snapshot is incomplete/);
    expect(() => validateSourceIngestionSnapshot({
      ...snapshot,
      bonap: {
        ...snapshot.bonap,
        countyOccurrences: [snapshot.bonap.countyOccurrences[0]],
      },
    }, validation)).toThrow(/covers 1 of 2 lower-48 counties/);
    expect(() => validateSourceIngestionSnapshot({
      ...snapshot,
      bonap: {
        ...snapshot.bonap,
        countyOccurrences: snapshot.bonap.countyOccurrences.map((row) => ({ ...row, nativityStatus: "native" })),
      },
    }, validation)).toThrow(/cannot be stored as county nativity/);
    expect(() => validateSourceIngestionSnapshot({
      ...snapshot,
      bonap: {
          ...snapshot.bonap,
          countyOccurrences: snapshot.bonap.countyOccurrences.map((row, index) =>
            index === 0
            ? { ...row, occurrenceTaxonCount: 1, speciesAndNothospeciesTaxonCount: 1, reportedSpeciesAndNothospeciesCount: 2 }
            : row,
        ),
      },
    }, validation)).toThrow(/pages or source count are invalid/);
  });

  it("preserves both last-good JSON snapshots when staged supplemental data fails", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "native-source-snapshot-test-"));
    tempDirectories.push(directory);
    const outputRangePath = path.join(directory, "range-evidence.json");
    const outputIngestionPath = path.join(directory, "source-ingestion.json");
    const reviewedMapBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
      "base64",
    );
    const mapUrl = "https://bonap.net/MapGallery/County/Echinacea%20purpurea.png";
    const mapSha256 = createHash("sha256").update(reviewedMapBytes).digest("hex");
    const reviewedMapAssetPath = path.join(directory, `${mapSha256}.png`);
    const mapSnapshot = {
      mapUrl,
      sha256: mapSha256,
      retrievedAt,
      etag: '"reviewed-map"',
      lastModified: "Fri, 19 May 2017 00:00:00 GMT",
      mapGenerationDate: null,
      mapGenerationDateSource: null,
      mapKeyUrl: BONAP_URLS.mapKey,
    };
    const mapReview = {
      plantId: plant.id,
      scientificName: plant.scientificName,
      mapUrl,
      mapSha256,
      mapGenerationDateFromContent: null,
      taxonomyMatch: "exact",
      mapScopeDecision: "confirmed_taxon_scope",
      reviewStatus: "approved",
      currentStatusConfirmed: true,
      reviewer: "native-data-reviewer",
      reviewedAt: retrievedAt,
      reviewNote: "Reviewed the county map and MapKey.",
      counties: [{ countyFips: "27053", rawCategory: "Native" }],
    };
    const reviewedMapEvidence = buildBonapCountyEvidence({
      plants: { [plant.id]: plant },
      mapSnapshots: [mapSnapshot],
      reviews: [mapReview],
      source: bonapSource,
    })[0];
    const goodRange = {
      version: "good",
      provenance: "last validated data",
      records: [
        buildPlantRangeEvidence({
          plant,
          masterId: 34475,
          profile,
          distributionCsv,
          countyFeatures: [feature()],
          source,
          retrievedAt,
        })[0],
        reviewedMapEvidence,
      ],
    };
    const goodIngestion = {
      version: "1",
      retrievedAt,
      provenance: "fixture snapshot",
      bonap: {
        sourceId: "bonap-napa",
        retrievedAt,
        fullTaxonList: fullTaxonListFixture(),
        taxonMatches: [{ plantId: plant.id, scientificName: plant.scientificName, matchStatus: "exact", bonapScientificName: plant.scientificName }],
        countyOccurrences: [{ countyFips: "27053", occurrenceTaxonCount: 0, speciesAndNothospeciesTaxonCount: 0, infraspecificTaxonCount: 0, reportedSpeciesAndNothospeciesCount: 0, pageCount: 1, pageUpdateMarkers: [{ page: "-1", etag: null, lastModified: null }], candidateTaxa: [], evidenceUse: "presence_only", retrievedAt }],
        taxonDetails: [],
        mapMappings: [{ plantId: plant.id, scientificName: plant.scientificName, mapPageUrl: "https://bonap.net/Napa/TaxonMaps/Genus/County/Echinacea", mapStatus: "exact", mapUrl, mapSha256 }],
        mapSnapshots: [{ ...mapSnapshot, assetPath: `data/natives/bonap-map-snapshots/${mapSha256}.png` }],
        reviewedMapRecordCount: 1,
      },
      npin: { sourceId: "npin", retrievedAt, enrichments: [{ plantId: plant.id, matchStatus: "unresolved", profileStatus: "not_attempted", nativityResolution: "none" }] },
    };
    const rangeValidation = {
      plantIds: [plant.id],
      sources: { "usda-plants": source, "bonap-napa": bonapSource },
      bonapMapSnapshots: [{
        mapUrl,
        sha256: mapSha256,
        mapKeyUrl: BONAP_URLS.mapKey,
        retrievedAt: mapSnapshot.retrievedAt,
        etag: mapSnapshot.etag,
        lastModified: mapSnapshot.lastModified,
        mapGenerationDate: mapSnapshot.mapGenerationDate,
        mapGenerationDateSource: mapSnapshot.mapGenerationDateSource,
      }],
      bonapReviewRecords: [mapReview],
    };
    const sourceValidation = { countyFipses: ["27053"], plantIds: [plant.id] };
    commitNativeEvidenceSnapshotAtomically({
      rangeEvidencePath: outputRangePath,
      rangeEvidence: goodRange,
      rangeValidation,
      sourceIngestionPath: outputIngestionPath,
      sourceIngestion: goodIngestion,
      sourceValidation,
      mapAssets: [{ path: reviewedMapAssetPath, bytes: reviewedMapBytes }],
    });
    const lastGoodRange = fs.readFileSync(outputRangePath, "utf8");
    const lastGoodIngestion = fs.readFileSync(outputIngestionPath, "utf8");

    const shortMapRefresh = async () => {
      const fullTaxonList = [
        "BONAP Taxonomic Data Center\t2014",
        "Family\tGenus\tScientific Name",
        "Asteraceae\tEchinacea\tEchinacea purpurea",
      ].join("\n");
      const truncatedPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
      const fetchImpl = async (input) => {
        const url = new URL(input);
        if (url.pathname.endsWith("FullTaxonList")) {
          return new Response(fullTaxonList, { status: 200 });
        }
        if (url.pathname.endsWith("SpeciesList")) {
          return new Response(JSON.stringify({ data: {
            DescriptionText: "A total of <span>0</span> species and nothospecies are reported.",
            NextPage: null,
            TaxonList: [],
          } }), { status: 200 });
        }
        if (url.pathname === "/Napa/TaxonMaps/Genus/County/Echinacea") {
          return new Response('<a href="/MapGallery/County/Echinacea%20purpurea.png">Echinacea purpurea</a>', { status: 200 });
        }
        if (url.pathname === "/MapGallery/County/Echinacea%20purpurea.png") {
          return new Response(truncatedPng, { status: 200 });
        }
        throw new Error(`Unexpected BONAP URL: ${url}`);
      };
      const supplemental = await fetchSupplementalSourceData({
        plants: { [plant.id]: plant },
        sources: { "bonap-napa": bonapSource },
        countyFipses: ["27053"],
        verifiedFullTaxonListBytes: Buffer.byteLength(fullTaxonList),
        fetchImpl,
      });
      commitNativeEvidenceSnapshotAtomically({
        rangeEvidencePath: outputRangePath,
        rangeEvidence: goodRange,
        rangeValidation,
        sourceIngestionPath: outputIngestionPath,
        sourceIngestion: supplemental.snapshot,
        sourceValidation,
        mapAssets: supplemental.mapAssets,
      });
    };

    await expect(shortMapRefresh()).rejects.toThrow(/BONAP county map is not a complete PNG image/);
    expect(fs.readFileSync(outputRangePath, "utf8")).toBe(lastGoodRange);
    expect(fs.readFileSync(outputIngestionPath, "utf8")).toBe(lastGoodIngestion);
    expect(JSON.parse(lastGoodRange).records).toContainEqual(reviewedMapEvidence);
    expect(fs.readFileSync(reviewedMapAssetPath)).toEqual(reviewedMapBytes);

    const shortTaxonText = [
      "BONAP Taxonomic Data Center\t2014",
      "Family\tGenus\tScientific Name",
      "Asteraceae\tEchinacea\tEchinacea purpurea",
    ].join("\n");
    const shortCountyResponse = {
      data: {
        DescriptionText: "A total of 2 species and nothospecies are reported.",
        NextPage: null,
        TaxonList: [{ Id: 1234, Name: "Echinacea purpurea" }],
      },
    };
    const shortListFetch = async (input) => {
      const url = new URL(input);
      if (url.pathname.endsWith("FullTaxonList")) {
        return new Response(shortTaxonText, { status: 200 });
      }
      if (url.pathname.endsWith("SpeciesList")) {
        return new Response(JSON.stringify(shortCountyResponse), { status: 200 });
      }
      throw new Error(`Unexpected BONAP URL: ${url}`);
    };
    const refreshWithShortCountyList = async () => {
      const sourceIngestion = await fetchSupplementalSourceData({
        plants: { [plant.id]: plant },
        sources: {},
        countyFipses: ["27053"],
        verifiedFullTaxonListBytes: Buffer.byteLength(shortTaxonText),
        fetchImpl: shortListFetch,
      });
      commitNativeEvidenceSnapshotAtomically({
        rangeEvidencePath: outputRangePath,
        rangeEvidence: goodRange,
        rangeValidation,
        sourceIngestionPath: outputIngestionPath,
        sourceIngestion,
        sourceValidation,
      });
    };

    await expect(refreshWithShortCountyList()).rejects.toThrow(
      /returned 1 species and nothospecies in 1 taxon rows for county 27053, but reported 2/,
    );
    expect(fs.readFileSync(outputRangePath, "utf8")).toBe(lastGoodRange);
    expect(fs.readFileSync(outputIngestionPath, "utf8")).toBe(lastGoodIngestion);

    expect(() => commitNativeEvidenceSnapshotAtomically({
      rangeEvidencePath: outputRangePath,
      rangeEvidence: goodRange,
      rangeValidation,
      sourceIngestionPath: outputIngestionPath,
      sourceIngestion: {
        ...goodIngestion,
        bonap: { ...goodIngestion.bonap, countyOccurrences: [] },
      },
      sourceValidation,
    })).toThrow(/covers 0 of 1 lower-48 counties/);
    expect(fs.readFileSync(outputRangePath, "utf8")).toBe(lastGoodRange);
    expect(fs.readFileSync(outputIngestionPath, "utf8")).toBe(lastGoodIngestion);
    expect(fs.existsSync(`${outputRangePath}.staged`)).toBe(false);
    expect(fs.existsSync(`${outputIngestionPath}.staged`)).toBe(false);

    expect(() => commitNativeEvidenceSnapshotAtomically({
      rangeEvidencePath: outputRangePath,
      rangeEvidence: goodRange,
      rangeValidation,
      sourceIngestionPath: outputIngestionPath,
      sourceIngestion: {
        ...goodIngestion,
        bonap: {
          ...goodIngestion.bonap,
          fullTaxonList: {
            ...goodIngestion.bonap.fullTaxonList,
            responseBytes: BONAP_FULL_TAXON_LIST_VERIFIED_BYTES - 1,
          },
        },
      },
      sourceValidation,
    })).toThrow(/FullTaxonList snapshot is incomplete/);
    expect(fs.readFileSync(outputRangePath, "utf8")).toBe(lastGoodRange);
    expect(fs.readFileSync(outputIngestionPath, "utf8")).toBe(lastGoodIngestion);

    const malformedPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
    const malformedHash = createHash("sha256").update(malformedPng).digest("hex");
    const malformedMapPath = path.join(directory, `${malformedHash}.png`);
    expect(() => commitNativeEvidenceSnapshotAtomically({
      rangeEvidencePath: outputRangePath,
      rangeEvidence: goodRange,
      rangeValidation,
      sourceIngestionPath: outputIngestionPath,
      sourceIngestion: goodIngestion,
      sourceValidation,
      mapAssets: [{ path: malformedMapPath, bytes: malformedPng }],
    })).toThrow(/BONAP county map PNG is invalid/);
    expect(fs.readFileSync(outputRangePath, "utf8")).toBe(lastGoodRange);
    expect(fs.readFileSync(outputIngestionPath, "utf8")).toBe(lastGoodIngestion);
    expect(fs.existsSync(malformedMapPath)).toBe(false);
    expect(fs.readFileSync(reviewedMapAssetPath)).toEqual(reviewedMapBytes);
  });

  it("validates generated files against the candidate species catalog", () => {
    const payload = {
      version: "usda-plants-live-2026-10-01",
      provenance: "retrieved from USDA",
      records: [
        buildPlantRangeEvidence({
          plant,
          masterId: 34475,
          profile,
          distributionCsv,
          countyFeatures: [feature()],
          source,
          retrievedAt,
        })[0],
      ],
    };
    expect(
      validateRangeEvidenceFile(payload, {
        plantIds: [plant.id],
        sources: { "usda-plants": source },
      }),
    ).toBe(payload);
    expect(() =>
      validateRangeEvidenceFile(payload, {
        plantIds: ["another-plant"],
        sources: { "usda-plants": source },
      }),
    ).toThrow(/unknown plantId/);
  });

  it("records source-specific refresh failure without changing either last-good snapshot", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "native-refresh-status-test-"));
    tempDirectories.push(directory);
    const rangePath = path.join(directory, "range.json");
    const ingestionPath = path.join(directory, "ingestion.json");
    const statusPath = path.join(directory, "refresh-status.json");
    const previousRange = JSON.stringify({
      records: [{ sourceId: "usda-plants", retrievedAt: "2026-09-01T12:00:00.000Z" }],
    });
    const previousIngestion = JSON.stringify({
      retrievedAt: "2026-09-01T12:00:00.000Z",
      bonap: { retrievedAt: "2026-09-01T12:00:00.000Z" },
      npin: { retrievedAt: "2026-09-01T12:00:00.000Z" },
    });
    fs.writeFileSync(rangePath, previousRange);
    fs.writeFileSync(ingestionPath, previousIngestion);
    const status = createNativeRefreshStatus({
      startedAt: "2026-10-01T12:00:00.000Z",
      rangeEvidence: JSON.parse(previousRange),
      sourceIngestion: JSON.parse(previousIngestion),
    });
    status.sources["bonap-napa"].status = "retrieving";
    failNativeRefreshStatus({
      filePath: statusPath,
      status,
      error: Object.assign(new Error("FullTaxonList was incomplete"), { sourceId: "bonap-napa" }),
      stage: "bonap-napa",
      completedAt: "2026-10-01T12:02:00.000Z",
    });

    expect(fs.readFileSync(rangePath, "utf8")).toBe(previousRange);
    expect(fs.readFileSync(ingestionPath, "utf8")).toBe(previousIngestion);
    expect(JSON.parse(fs.readFileSync(statusPath, "utf8"))).toMatchObject({
      status: "failed",
      lastGoodSnapshotRetrievedAt: "2026-09-01T12:00:00.000Z",
      failures: [{ sourceId: "bonap-napa", message: "FullTaxonList was incomplete" }],
      sources: {
        "bonap-napa": {
          status: "failed",
          lastSuccessAt: "2026-09-01T12:00:00.000Z",
        },
      },
    });
  });
});
