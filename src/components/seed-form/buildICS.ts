import type { GardenSeason } from "@/planning";
import { seasonDisplayLabel } from "./seasonLabel";

export function buildICS(
  tasks: { label: string; date: string }[],
  zip: string,
  season: GardenSeason = "spring",
) {
  const seasonLabel = seasonDisplayLabel(season);
  const events = tasks.map(({ label, date }) => {
    const d = new Date(date);
    const yyyy = d.getFullYear().toString().padStart(4, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    const dt = `${yyyy}${mm}${dd}`;
    const summary = `[${seasonLabel}] ${label}`;
    const uid = `${label.replace(/\s+/g, "-")}-${dt}@seedstarter`;
    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dt}T120000Z`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:${summary}`,
      "END:VEVENT",
    ].join("\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//SeedStarter//${seasonLabel}//${zip}`,
    `X-WR-CALNAME:Seed Starter ${seasonLabel} (${zip})`,
    ...events,
    "END:VCALENDAR",
  ].join("\n");
}
