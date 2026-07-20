import { describe, expect, it } from "vitest";
import { suggestSeasonFromFrost } from "./defaultSeason";

describe("suggestSeasonFromFrost", () => {
  const springFrost = new Date(2026, 3, 15); // Apr 15
  const fallFrost = new Date(2026, 9, 5); // Oct 5

  it("prefers spring before and just after last frost", () => {
    expect(
      suggestSeasonFromFrost({
        now: new Date(2026, 2, 1),
        lastSpringFrostP50: springFrost,
        firstFallFrostP50: fallFrost,
      }),
    ).toBe("spring");
    expect(
      suggestSeasonFromFrost({
        now: new Date(2026, 3, 20),
        lastSpringFrostP50: springFrost,
        firstFallFrostP50: fallFrost,
      }),
    ).toBe("spring");
  });

  it("flips to fall after spring transplant window", () => {
    expect(
      suggestSeasonFromFrost({
        now: new Date(2026, 4, 20), // May 20 > Apr 15 + 30
        lastSpringFrostP50: springFrost,
        firstFallFrostP50: fallFrost,
      }),
    ).toBe("fall");
    expect(
      suggestSeasonFromFrost({
        now: new Date(2026, 7, 15),
        lastSpringFrostP50: springFrost,
        firstFallFrostP50: fallFrost,
      }),
    ).toBe("fall");
  });

  it("returns spring after first fall frost (next year)", () => {
    expect(
      suggestSeasonFromFrost({
        now: new Date(2026, 9, 10),
        lastSpringFrostP50: springFrost,
        firstFallFrostP50: fallFrost,
      }),
    ).toBe("spring");
  });

  it("stays spring when fall frost missing", () => {
    expect(
      suggestSeasonFromFrost({
        now: new Date(2026, 7, 15),
        lastSpringFrostP50: springFrost,
        firstFallFrostP50: null,
      }),
    ).toBe("spring");
  });
});
