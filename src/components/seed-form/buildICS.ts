import type { GardenSeason } from "@/planning";
import { seasonDisplayLabel } from "./seasonLabel";

// iCalendar TEXT values escape backslashes, newlines, commas, and semicolons.
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[,;]/g, "\\$&");
}

export function buildICS(
  tasks: { label: string; date: string }[],
  zip: string,
  season: GardenSeason = "spring",
) {
  const seasonLabel = seasonDisplayLabel(season);
  const events = tasks.map(({ label, date }) => {
    // Keep the schedule's calendar date, as CSV does, regardless of browser timezone.
    const dt = date.split("T")[0].replace(/-/g, "");
    const summary = `[${seasonLabel}] ${label}`;
    const uid = `${label.replace(/\s+/g, "-")}-${dt}@seedstarter`;
    return [
      "BEGIN:VEVENT",
      `UID:${escapeText(uid)}`,
      `DTSTAMP:${dt}T120000Z`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:${escapeText(summary)}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${escapeText(`-//SeedStarter//${seasonLabel}//${zip}`)}`,
    `X-WR-CALNAME:${escapeText(`Seed Starter ${seasonLabel} (${zip})`)}`,
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
