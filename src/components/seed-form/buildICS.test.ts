import { describe, expect, it } from "vitest";
import { buildICS } from "./buildICS";

describe("buildICS", () => {
  it("builds valid calendar content", () => {
    const ics = buildICS(
      [{ label: "Sow Tomato indoors", date: "2026-02-01T12:00:00.000Z" }],
      "55423",
    );
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("[Spring] Sow Tomato indoors");
    expect(ics).toContain("X-WR-CALNAME:Seed Starter Spring (55423)");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("prefixes fall season on events", () => {
    const ics = buildICS(
      [{ label: "Sow Carrot for fall harvest", date: "2026-08-01T12:00:00.000Z" }],
      "55423",
      "fall",
    );
    expect(ics).toContain("[Fall] Sow Carrot for fall harvest");
    expect(ics).toContain("X-WR-CALNAME:Seed Starter Fall (55423)");
  });

  it("prefixes summer season on events", () => {
    const ics = buildICS(
      [{ label: "Direct sow Beans (summer)", date: "2026-06-01T12:00:00.000Z" }],
      "55423",
      "summer",
    );
    expect(ics).toContain("[Summer] Direct sow Beans (summer)");
  });
});
