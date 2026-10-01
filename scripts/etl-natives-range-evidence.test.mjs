import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPlantRangeEvidence,
  commitRangeEvidenceAtomically,
  countyCodeFromSymbol,
  discoverRangeEvidenceChanges,
  fetchRangeEvidence,
  indexDistributionFips,
  parseDistributionDocumentation,
  PLANTS_API,
  COUNTY_LAYER_URL,
  validateRangeEvidenceFile,
} from "./etl-natives-range-evidence.mjs";

const source = {
  authority: "USDA PLANTS",
  licenseNote: "PLANTS information may be used with citation.",
  rangeEvidenceAvailable: true,
};
const plant = {
  id: "echinacea-purpurea",
  scientificName: "Echinacea purpurea",
};
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
      nativityStatus: "native",
      spatialResolution: "county",
      geographicScope: expect.stringContaining("state and county FIPS unknown"),
    });
    expect(unresolved[0].uncertainty).toContain("cannot match a ZIP county");
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
});
