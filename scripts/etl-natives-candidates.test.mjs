import { describe, expect, it } from "vitest";
import {
  binomialName,
  buildCandidatePlant,
  habitFromGrowthHabits,
  mergeCandidatePlants,
} from "./etl-natives-candidates.mjs";

describe("USDA culturally significant candidate ETL", () => {
  it("normalizes a USDA botanical name to its accepted binomial", () => {
    expect(binomialName("<i>Asclepias syriaca</i> L.")).toBe("Asclepias syriaca");
    expect(binomialName("<i>×Argyrautia</i> exampleensis (A. Gray)")).toBe(
      "x Argyrautia exampleensis",
    );
  });

  it("maps USDA growth-habit labels to the native catalog vocabulary", () => {
    expect(habitFromGrowthHabits(["Graminoid", "Forb/herb"])).toBe("grass");
    expect(habitFromGrowthHabits(["Forb/herb", "Vine"])).toBe("vine");
    expect(habitFromGrowthHabits(["Shrub", "Tree"])).toBe("shrub");
    expect(habitFromGrowthHabits(["Tree"])).toBe("tree");
    expect(habitFromGrowthHabits(["Unknown"])).toBeNull();
  });

  it("requires exact species identity, L48 Native status, and a guide", () => {
    const row = {
      Symbol: "TEST1",
      ScientificName: "Testa exampleensis",
      CommonName: "example plant",
      FilePath: "\\DocumentLibrary\\plantguide\\pdf\\cs_test1.pdf",
    };
    const profile = {
      Id: 123,
      Symbol: "TEST1",
      ScientificName: "<i>Testa exampleensis</i> L.",
      Rank: "Species",
      GrowthHabits: ["Forb/herb"],
      NativeStatuses: [{ Region: "L48", Status: "N", Type: "Native" }],
      PlantGuideUrls: [],
    };
    const result = buildCandidatePlant(row, profile, "2026-10-07T00:00:00.000Z");
    expect(result.status).toBe("included");
    expect(result.plant).toMatchObject({
      id: "testa-exampleensis",
      habit: "forb",
      catalogSource: {
        sourceId: "usda-culturally-significant",
        symbol: "TEST1",
        profileId: 123,
        plantGuideUrl: "https://plantsservices.sc.egov.usda.gov/DocumentLibrary/plantguide/pdf/cs_test1.pdf",
      },
    });
  });

  it("does not replace an existing curated plant with imported defaults", () => {
    const existing = {
      "testa-exampleensis": {
        id: "testa-exampleensis",
        scientificName: "Testa exampleensis",
        commonName: "Curated example",
        habit: "forb",
        method: "direct",
        sourceUrl: "https://plants.usda.gov/plant-profile?symbol=TEST1",
        confidence: "high",
      },
    };
    const discovered = {
      "testa-exampleensis": {
        ...existing["testa-exampleensis"],
        commonName: "Imported example",
        confidence: "low",
      },
    };
    expect(mergeCandidatePlants(existing, discovered)).toEqual(existing);
  });
});
