import { describe, expect, it } from "vitest";
import { groupTasksByCrop, isPastTask } from "./taskUtils";

describe("taskUtils", () => {
  it("groups and sorts tasks by crop", () => {
    const groups = groupTasksByCrop([
      { cropId: "tomato", type: "transplant", date: "2026-05-01T12:00:00.000Z", label: "t" },
      { cropId: "tomato", type: "indoor_sow", date: "2026-02-01T12:00:00.000Z", label: "s" },
    ]);
    expect(groups.get("tomato")?.map((t) => t.type)).toEqual(["indoor_sow", "transplant"]);
  });

  it("detects past tasks", () => {
    expect(isPastTask("2020-01-01T12:00:00.000Z")).toBe(true);
  });
});
