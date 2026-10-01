import { describe, expect, it } from "vitest";
import {
  affirmativeCountyEvidenceForPlant,
  summarizeNativeRangeEvidence,
} from "./rangeEvidence";
import {
  nativeRangeEvidenceSchema,
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
  it("matches affirmative USDA PLANTS evidence only at the resolved county", () => {
    const claim = record({ spatialResolution: "finer" });
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
      unknownCount: 0,
      missingCount: 2,
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
