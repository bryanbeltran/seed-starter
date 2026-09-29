import { describe, expect, it } from "vitest";
import { buildICS } from "./buildICS";

describe("buildICS", () => {
  it("escapes calendar text without introducing extra properties", () => {
    const ics = buildICS(
      [{ label: "Harvest Cucumber (Cucumber, Armenian); bed \\1\r\nDESCRIPTION:extra", date: "2026-08-01" }],
      "55423",
    );

    expect(ics).toContain(
      "SUMMARY:[Spring] Harvest Cucumber (Cucumber\\, Armenian)\\; bed \\\\1\\nDESCRIPTION:extra",
    );
    expect(ics).toContain(
      "UID:Harvest-Cucumber-(Cucumber\\,-Armenian)\\;-bed-\\\\1-DESCRIPTION:extra-20260801@seedstarter",
    );
    expect(ics.split(/\r?\n/)).not.toContain("DESCRIPTION:extra");
  });

  it("uses CRLF content lines and terminates the calendar with CRLF", () => {
    const ics = buildICS([{ label: "Harvest Tomato", date: "2026-08-01" }], "55423");
    expect(ics).not.toMatch(/(?<!\r)\n/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
  });

  // Also run with TZ=America/Los_Angeles to catch accidental local-date conversion.
  it.each([
    ["2026-02-01T00:00:00.000Z", "20260201"],
    ["2027-01-01T00:00:00.000Z", "20270101"],
    ["2026-06-01", "20260601"],
  ])("preserves the schedule date %s in all-day events", (date, expected) => {
    const ics = buildICS([{ label: "Sow Tomato indoors", date }], "55423");

    expect(ics).toContain(`DTSTART;VALUE=DATE:${expected}`);
    expect(ics).toContain(`UID:Sow-Tomato-indoors-${expected}@seedstarter`);
  });

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
