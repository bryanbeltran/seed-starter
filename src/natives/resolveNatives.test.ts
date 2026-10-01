import { describe, expect, it } from "vitest";
import plantsData from "../../data/natives/plants.json";
import ecoregionPlantsData from "../../data/natives/ecoregion-plants.json";
import { lookupZipCounty, lookupZipCountyFips } from "./lookupCounty";
import { lookupZipEcoregion } from "./lookupEcoregion";
import { resolveNatives, tasksForPlant } from "./resolveNatives";
import { nativePlantSchema, type NativePlant } from "./schema";
import { getFileClimateRepository } from "@/climate";

const plants = Object.fromEntries(
  Object.entries(plantsData.plants).map(([id, plant]) => [
    id,
    nativePlantSchema.parse(plant),
  ]),
) as Record<string, NativePlant>;

function plant(id: string) {
  return plants[id];
}

describe("lookupZipEcoregion", () => {
  it("maps 55423 to L3 51", () => {
    expect(lookupZipEcoregion("55423")).toEqual({
      id: "51",
      name: "North Central Hardwood Forests",
    });
  });
});

describe("lookupZipCounty", () => {
  it("maps 55423 to Hennepin MN", () => {
    expect(lookupZipCounty("55423")).toEqual({
      fips: "27053",
      name: "Hennepin",
      state: "MN",
    });
  });

  it("returns all Census county intersections, including non-primary counties", () => {
    expect(lookupZipCountyFips("57722")).toEqual(["46033", "46047", "46113"]);
    expect(lookupZipCounty("57722")).not.toBeNull();
  });

  it("does not fabricate a county overlay name for unresolved 2010 FIPS metadata", () => {
    expect(lookupZipCounty("57716")).toBeNull();
    expect(lookupZipCountyFips("57716")).toContain("46113");
  });
});

describe("resolveNatives", () => {
  const ref = new Date(2026, 0, 15);
  const climate = getFileClimateRepository();

  it("does not treat ecoregion catalog membership as local range evidence", () => {
    const result = resolveNatives({ zip: "55423", zone: "5a", referenceDate: ref });
    expect(result.catalogCoverage).toBe("full");
    expect(result.ecoregion?.id).toBe("51");
    expect(result.county?.fips).toBe("27053");
    expect(result.plants).toEqual([]);
    expect(result.rangeEvidenceCoverage).toMatchObject({
      status: "no_local_evidence",
      catalogCandidateCount: expect.any(Number),
      affirmativeCount: 0,
      notNativeCount: 0,
      missingCount: expect.any(Number),
    });
    expect(result.rangeEvidenceCoverage.catalogCandidateCount).toBeGreaterThan(0);
    expect(result.rangeEvidenceCoverage.missingCount).toBe(
      result.rangeEvidenceCoverage.catalogCandidateCount,
    );
  });

  it.each([
    ["80202", "5b", "25"],
    ["10001", "7b", "59"],
    ["60601", "6a", "54"],
  ])("does not recommend unverified catalog plants for %s", (zip, zone, id) => {
    const result = resolveNatives({ zip, zone, referenceDate: ref });
    expect(result.ecoregion?.id).toBe(id);
    expect(result.catalogCoverage).toBe("full");
    expect(result.plants).toEqual([]);
    expect(result.rangeEvidenceCoverage.status).toBe("no_local_evidence");
  });

  it("distinguishes an ecoregion with no candidate catalog", () => {
    const result = resolveNatives({ zip: "10301", zone: "7b", referenceDate: ref });
    expect(result.ecoregion?.id).toBe("64");
    expect(result.catalogCoverage).toBe("none");
    expect(result.plants).toEqual([]);
    expect(result.rangeEvidenceCoverage.status).toBe("no_catalog");
  });

  it("reports no catalog for a ZIP with a resolved county but no L3 mapping", () => {
    const result = resolveNatives({ zip: "11109", zone: "7b", referenceDate: ref });

    expect(result.ecoregion).toBeNull();
    expect(result.county?.fips).toBe("36081");
    expect(result.catalogCoverage).toBe("unknown");
    expect(result.rangeEvidenceCoverage).toMatchObject({
      status: "no_catalog",
      catalogCandidateCount: 0,
    });
    expect(result.plants).toEqual([]);
  });

  it("reports unresolved geography separately from missing nativity evidence", () => {
    const result = resolveNatives({ zip: "99999", zone: "5a", referenceDate: ref });
    expect(result.ecoregion).toBeNull();
    expect(result.county).toBeNull();
    expect(result.catalogCoverage).toBe("unknown");
    expect(result.rangeEvidenceCoverage.status).toBe("unresolved_geography");
    expect(result.plants).toEqual([]);
  });

  it("keeps stratification sowing earlier than non-stratifying sowing", () => {
    const frost = new Date(2026, 4, 15);
    const echinacea = tasksForPlant(plant("echinacea-purpurea"), frost, "spring");
    const ratibida = tasksForPlant(plant("ratibida-pinnata"), frost, "spring");
    expect(ratibida[0].date.getTime()).toBeLessThan(echinacea[0].date.getTime());
  });

  it("emits fall dormant sow only for plants marked for it", () => {
    const result = resolveNatives({
      zip: "55423",
      zone: "5a",
      season: "fall",
      referenceDate: ref,
    });
    expect(result.season).toBe("fall");
    expect(result.plants).toEqual([]);
    expect(result.rangeEvidenceCoverage.status).toBe("no_local_evidence");

    const fallPlants = Object.values(plants).filter((candidate) => candidate.fallDormant);
    expect(fallPlants.length).toBeGreaterThan(0);
    expect(
      fallPlants.every(
        (candidate) =>
          tasksForPlant(candidate, new Date(2026, 8, 15), "fall")[0]?.type ===
          "fall_sow",
      ),
    ).toBe(true);
    expect(
      tasksForPlant(plant("echinacea-purpurea"), new Date(2026, 8, 15), "fall"),
    ).toEqual([]);
  });

  it("applies riskProfile to frost anchors and the resulting sow dates", () => {
    const conservative = resolveNatives({
      zip: "55423",
      zone: "5a",
      riskProfile: "conservative",
      referenceDate: ref,
      climateLookup: climate,
    });
    const aggressive = resolveNatives({
      zip: "55423",
      zone: "5a",
      riskProfile: "aggressive",
      referenceDate: ref,
      climateLookup: climate,
    });
    expect(conservative.lastFrostDate.getTime()).toBeGreaterThan(
      aggressive.lastFrostDate.getTime(),
    );
    const candidate = plant("echinacea-purpurea");
    const conservativeSow = tasksForPlant(
      candidate,
      conservative.lastFrostDate,
      "spring",
    )[0].date;
    const aggressiveSow = tasksForPlant(
      candidate,
      aggressive.lastFrostDate,
      "spring",
    )[0].date;
    expect(conservativeSow.getTime()).toBeGreaterThan(aggressiveSow.getTime());
  });

  it("inverts riskProfile for fall frost anchors", () => {
    const conservative = resolveNatives({
      zip: "55423",
      zone: "5a",
      season: "fall",
      riskProfile: "conservative",
      referenceDate: ref,
      climateLookup: climate,
    });
    const aggressive = resolveNatives({
      zip: "55423",
      zone: "5a",
      season: "fall",
      riskProfile: "aggressive",
      referenceDate: ref,
      climateLookup: climate,
    });
    expect(conservative.lastFrostDate.getTime()).toBeLessThan(
      aggressive.lastFrostDate.getTime(),
    );
  });

  it("uses stratificationDays as the fall sow offset", () => {
    const frost = new Date(2026, 8, 15);
    const ratibida = tasksForPlant(plant("ratibida-pinnata"), frost, "fall");
    const expected = new Date(frost);
    expected.setDate(expected.getDate() - 60);
    expect(ratibida[0].date.toDateString()).toBe(expected.toDateString());
  });

  it("keeps the ecoregion candidate catalog unchanged while evidence is absent", () => {
    expect(ecoregionPlantsData.ecoregions["51"].plantIds).toContain(
      "echinacea-purpurea",
    );
    expect(resolveNatives({ zip: "55423", zone: "5a", referenceDate: ref }).plants)
      .toEqual([]);
  });
});
