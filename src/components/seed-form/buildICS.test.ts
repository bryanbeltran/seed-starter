import { describe, expect, it } from "vitest";
import { buildICS } from "./buildICS";

describe("buildICS", () => {
  it("gives repeated tasks distinct, repeatable event IDs", () => {
    const task = { label: "Sow Tomato", date: "2026-03-01" };
    const tasks = [task, task, task];
    const ics = buildICS(tasks, "55423");
    const ids = ics.replace(/\r\n /g, "").split("\r\n").filter((line) => line.startsWith("UID:"));

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(buildICS(tasks, "55423")).toBe(ics);
  });

  it("disambiguates labels that normalize to the same event ID", () => {
    const tasks = ["Sow Tomato", "Sow-Tomato", "Sow  Tomato"].map((label) => ({
      label,
      date: "2026-03-01",
    }));
    const ids = buildICS(tasks, "55423").split("\r\n").filter((line) => line.startsWith("UID:"));
    expect(new Set(ids).size).toBe(3);
  });

  it("escapes calendar text without introducing extra properties", () => {
    const ics = buildICS(
      [{ label: "Harvest Cucumber (Cucumber, Armenian); bed \\1\r\nDESCRIPTION:extra", date: "2026-08-01" }],
      "55423",
    );

    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(
      "SUMMARY:[Spring] Harvest Cucumber (Cucumber\\, Armenian)\\; bed \\\\1\\nDESCRIPTION:extra",
    );
    expect(unfolded).toContain(
      "UID:Harvest-Cucumber-(Cucumber\\,-Armenian)\\;-bed-\\\\1-DESCRIPTION:extra-20260801@seedstarter",
    );
    expect(ics.split(/\r?\n/)).not.toContain("DESCRIPTION:extra");
  });

  it.each(["A".repeat(160), "🌱é".repeat(40)])(
    "folds long UTF-8 content lines without losing text (%s)",
    (name) => {
      const label = `Harvest ${name}`;
      const ics = buildICS([{ label, date: "2026-08-01" }], "55423");
      const lines = ics.split("\r\n");

      expect(lines.some((line) => line.startsWith(" "))).toBe(true);
      for (const line of lines) {
        expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
      }
      const unfolded = ics.replace(/\r\n /g, "");
      expect(unfolded).toContain(`SUMMARY:[Spring] ${label}\r\n`);
      expect(unfolded).toContain(
        `UID:Harvest-${name}-20260801@seedstarter\r\n`,
      );
    },
  );

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
