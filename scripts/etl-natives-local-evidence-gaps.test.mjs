import { describe, expect, it } from "vitest";
import { buildLocalEvidenceCoverageRecords } from "./etl-natives-local-evidence-gaps.mjs";

const sources = {
  "usda-plants": {
    authority: "USDA PLANTS",
    rangeEvidenceAvailable: true,
    licenseNote: "PLANTS information may be used with citation.",
  },
};

const catalog = {
  zctas: { "10001": { plantSetId: 0 } },
  plantSets: [["plant-a"]],
};

const countyData = {
  intersections: {
    "10001": [
      { fips: "01001", stateFips: "01" },
      { fips: "01003", stateFips: "01" },
    ],
  },
  counties: {
    "01001": { name: "Autauga", state: "AL" },
    "01003": { name: "Baldwin", state: "AL" },
  },
};

const existingClaim = {
  plantId: "plant-a",
  sourceId: "usda-plants",
  sourceCitation: "USDA, NRCS. PLANTS Database. Plant A. County status.",
  sourceUrl: "https://apps.geo.fpac.usda.gov/nrcs-geodata/rest/services/land_use_land_cover/plants/MapServer/6",
  releaseOrObservationDate: null,
  retrievedAt: "2026-10-07T09:00:00.000Z",
  licenseNote: sources["usda-plants"].licenseNote,
  geographicScope: "County or county-equivalent: Autauga, AL.",
  spatialResolution: "county",
  countyFips: "01001",
  nativityStatus: "native",
  uncertainty: null,
};

describe("local native evidence coverage markers", () => {
  it("adds unknown markers only for missing candidate/county pairs", () => {
    const markers = buildLocalEvidenceCoverageRecords({
      catalog,
      countyData,
      plants: { "plant-a": { scientificName: "Plant a" } },
      sources,
      records: [existingClaim],
      retrievedAt: "2026-10-07T09:00:00.000Z",
    });

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      plantId: "plant-a",
      countyFips: "01003",
      nativityStatus: "unknown",
      spatialResolution: "county",
      sourceId: "usda-plants",
    });
    expect(markers[0].uncertainty).toContain("not evidence of non-native status");
    expect(markers[0].sourceCitation).toContain("Baldwin, AL");
  });
});
