import { describe, expect, it } from "vitest";
import type { NativeRangeEvidence, NativeSource } from "./schema";
import {
  affirmativeCountyEvidenceForPlant,
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

describe("range evidence across all ZCTA county intersections", () => {
  it("returns affirmative evidence from a secondary county intersection", () => {
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
    ).toEqual([secondaryCountyRecord]);
  });

  it("allows one affirmative intersecting county without borrowing another county's status", () => {
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
      status: "affirmative_evidence",
      affirmativeCount: 1,
      notNativeCount: 0,
    });
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
