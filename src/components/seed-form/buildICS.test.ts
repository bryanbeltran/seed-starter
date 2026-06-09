import { describe, expect, it } from "vitest";
import { buildICS } from "./buildICS";

describe("buildICS", () => {
  it("builds valid calendar content", () => {
    const ics = buildICS(
      [{ label: "Sow Tomato indoors", date: "2026-02-01T12:00:00.000Z" }],
      "55423",
    );
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("Sow Tomato indoors");
    expect(ics).toContain("END:VCALENDAR");
  });
});
