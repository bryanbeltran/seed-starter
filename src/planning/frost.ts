import springFrostData from "./frostDates.json";
import fallFrostData from "./fallFrostDates.json";
import type { GardenSeason } from "./types";

const springFrostDates: Record<string, string> = springFrostData;
const fallFrostDates: Record<string, string> = fallFrostData;

const DEFAULT_ZONE = "4a";

export function frostDateStringForZone(zone: string): string {
  return springFrostDates[zone] ?? springFrostDates[DEFAULT_ZONE];
}

export function fallFrostDateStringForZone(zone: string): string {
  return fallFrostDates[zone] ?? fallFrostDates[DEFAULT_ZONE];
}

export function frostDateStringForZoneBySeason(
  zone: string,
  season: GardenSeason,
): string {
  return season === "fall"
    ? fallFrostDateStringForZone(zone)
    : frostDateStringForZone(zone);
}

export function nextFrostDate(
  month: number,
  day: number,
  referenceDate: Date = new Date(),
): Date {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const frost = new Date(year, month - 1, day);
  if (frost < today) return new Date(year + 1, month - 1, day);
  return frost;
}

export function lastFrostDateForZone(
  zone: string,
  referenceDate: Date = new Date(),
): Date {
  const [month, day] = frostDateStringForZone(zone).split("-").map(Number);
  return nextFrostDate(month, day, referenceDate);
}

export function firstFallFrostDateForZone(
  zone: string,
  referenceDate: Date = new Date(),
): Date {
  const [month, day] = fallFrostDateStringForZone(zone).split("-").map(Number);
  return nextFrostDate(month, day, referenceDate);
}
