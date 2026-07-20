import { describe, expect, it } from "vitest";
import { frostAnchorLabel, seasonDisplayLabel } from "./seasonLabel";

describe("seasonLabel", () => {
  it("labels seasons", () => {
    expect(seasonDisplayLabel("spring")).toBe("Spring");
    expect(seasonDisplayLabel("summer")).toBe("Summer");
    expect(seasonDisplayLabel("fall")).toBe("Fall");
  });

  it("labels frost anchors by season", () => {
    expect(frostAnchorLabel("spring")).toBe("Last spring frost");
    expect(frostAnchorLabel("summer")).toBe("Last spring frost");
    expect(frostAnchorLabel("fall")).toBe("First fall frost");
  });
});
