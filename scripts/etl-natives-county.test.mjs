import { describe, expect, it } from "vitest";
import { buildCountyData } from "./etl-natives-county.mjs";

describe("Census ZCTA county ETL", () => {
  it("keeps every county intersection and retains unresolved vintage metadata", () => {
    const relationship = [
      "ZCTA5,STATE,COUNTY,GEOID,ZPOPPCT",
      "55423,27,053,27053,75",
      "55423,27,123,27123,25",
      "57716,46,113,46113,100",
    ].join("\n");
    const countyNames = {
      "27053": { name: "Hennepin", state: "MN" },
      "27123": { name: "Ramsey", state: "MN" },
    };

    const { data, missingName } = buildCountyData(relationship, countyNames, {
      minZipCount: 0,
    });

    expect(data.zips["55423"]).toBe("27053");
    expect(data.intersections["55423"]).toEqual([
      { fips: "27053", stateFips: "27", populationShare: 75 },
      { fips: "27123", stateFips: "27", populationShare: 25 },
    ]);
    expect(data.intersections["57716"]).toEqual([
      { fips: "46113", stateFips: "46", populationShare: 100 },
    ]);
    expect(data.counties["46113"]).toEqual({ name: null, state: "SD" });
    expect(missingName).toBe(1);
  });

  it("rejects a Census file without the required relationship columns", () => {
    expect(() =>
      buildCountyData(
        ["ZCTA5,STATE,COUNTY,GEOID", "55423,27,053,27053"].join("\n"),
        {},
        { minZipCount: 0 },
      ),
    ).toThrow(/missing required columns/);
  });
});
