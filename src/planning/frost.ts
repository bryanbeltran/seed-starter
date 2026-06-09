import frostDatesData from "./frostDates.json";

const frostDates: Record<string, string> = frostDatesData;

const DEFAULT_ZONE = "4a";

export function frostDateStringForZone(zone: string): string {
  return frostDates[zone] ?? frostDates[DEFAULT_ZONE];
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
