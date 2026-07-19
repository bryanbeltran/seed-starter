import { describe, expect, it } from "vitest";
import {
  computeNeededStationIds,
  fallFrostPercentiles,
  firstFallFrostMmDdPerYear,
  frostPercentiles,
  frostSummaryFromParsedTmin,
  lastFrostMmDdPerYear,
  nearestStationWithTmin,
  parseGhcndDailyTmin,
  parseGhcndInventory,
  parsePhzmZipCsv,
  selectRepresentativeStations,
  stationHasFrostTmin,
} from "../../scripts/lib/ghcn-zip-climate.mjs";

describe("GHCN ETL helpers", () => {
  it("parses monthly GHCN TMIN rows", () => {
    const line =
      "USW00014922193804TMIN-9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999     -17  0   11  0";
    const byYear = parseGhcndDailyTmin(line) as Record<string, [string, string, number][]>;
    expect(byYear["1938"]?.some(([, , t]: [string, string, number]) => t < 0)).toBe(true);
  });

  it("filters US TMIN inventory", () => {
    const text = [
      "USW00014922  44.8806  -93.2169 TMIN 1938 2024",
      "USX00014922  44.8806  -93.2169 PRCP 1938 2024",
      "CAX00014922  44.8806  -93.2169 TMIN 1938 2024",
    ].join("\n");
    expect(parseGhcndInventory(text, 2020)).toEqual(["USW00014922"]);
  });

  it("picks nearest station with frost TMIN", () => {
    const stations = [
      { id: "A", name: "A", lat: 44.98, lon: -93.27 },
      { id: "B", name: "B", lat: 40.75, lon: -73.99 },
    ];
    const tmin = {
      B: { "2024": [["03", "15", -1]] },
    };
    const { station } = nearestStationWithTmin(
      { lat: 44.98, lon: -93.27 },
      stations,
      tmin,
    );
    expect(station?.id).toBe("B");
    expect(stationHasFrostTmin("B", tmin)).toBe(true);
  });

  it("computes needed station ids", () => {
    const centroids = { "55423": { lat: 44.888, lon: -93.284 } };
    const stations = [
      { id: "NEAR", name: "Near", lat: 44.88, lon: -93.22 },
      { id: "FAR", name: "Far", lat: 40.75, lon: -73.99 },
    ];
    const tmin = { FAR: { "2024": [["04", "01", -2]] } };
    expect(computeNeededStationIds(centroids, stations, tmin)).toEqual(["NEAR"]);
  });

  it("selects grid representative stations", () => {
    const stations = [
      { id: "A", name: "A", lat: 44.1, lon: -93.1 },
      { id: "B", name: "B", lat: 44.2, lon: -93.2 },
      { id: "C", name: "C", lat: 40.1, lon: -74.1 },
    ];
    const reps = selectRepresentativeStations(stations, 1);
    expect(reps).toHaveLength(2);
  });

  it("parses PHZM CSV zones", () => {
    const zones = parsePhzmZipCsv(
      "zipcode,zone,trange\n00501,7b,5 to 10\n55423,5a,-20 to -15\n",
    ) as Record<string, string>;
    expect(zones["55423"]).toBe("5a");
  });

  it("derives frost percentiles", () => {
    const byYear = lastFrostMmDdPerYear("S", {
      S: {
        "2020": [["04", "10", -1]],
        "2021": [["04", "20", -1]],
        "2022": [["04", "15", -1]],
      },
    });
    const p = frostPercentiles(byYear);
    expect(p.p50).toMatch(/^\d{2}-\d{2}$/);
  });

  it("parses TMIN across all months (fall included)", () => {
    const line =
      "USW00014922202410TMIN-9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999   -9999    -17  0";
    const byYear = parseGhcndDailyTmin(line) as Record<string, [string, string, number][]>;
    expect(byYear["2024"]?.some(([m]: [string, string, number]) => m === "10")).toBe(true);
  });

  it("summarizes spring lastFrost and fall firstFallFrost from a year", () => {
    const summary = frostSummaryFromParsedTmin({
      "2024": [
        ["03", "10", -2],
        ["04", "15", -1],
        ["05", "20", 2],
        ["09", "05", 3],
        ["10", "12", -1],
        ["11", "05", -3],
      ],
    }) as { year: number; lastFrost?: string; firstFallFrost?: string }[];
    expect(summary).toEqual([
      { year: 2024, lastFrost: "04-15", firstFallFrost: "10-12" },
    ]);
  });

  it("splits summary into spring and fall accessors", () => {
    const tmin = {
      S: {
        "2024": [
          ["04", "10", -1],
          ["10", "20", -1],
        ],
        "2025": [["04", "12", -1]],
      },
    };
    expect(lastFrostMmDdPerYear("S", tmin)).toEqual([
      { year: 2024, lastFrost: "04-10", firstFallFrost: "10-20" },
      { year: 2025, lastFrost: "04-12" },
    ]);
    expect(firstFallFrostMmDdPerYear("S", tmin)).toEqual([
      { year: 2024, lastFrost: "04-10", firstFallFrost: "10-20" },
    ]);
  });

  it("derives fall frost percentiles", () => {
    const byYear = firstFallFrostMmDdPerYear("S", {
      S: {
        "2020": [["10", "05", -1]],
        "2021": [["10", "12", -2]],
        "2022": [["10", "20", -1]],
      },
    });
    const p = fallFrostPercentiles(byYear);
    expect(p).not.toBeNull();
    expect(p!.p50).toMatch(/^\d{2}-\d{2}$/);
  });

  it("stays back-compat with legacy spring-only cache arrays", () => {
    const tmin = { S: [{ year: 2020, lastFrost: "04-10" }] };
    expect(lastFrostMmDdPerYear("S", tmin)).toEqual([
      { year: 2020, lastFrost: "04-10" },
    ]);
    expect(firstFallFrostMmDdPerYear("S", tmin)).toEqual([]);
  });
});
