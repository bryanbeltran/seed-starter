import type { GardenSeason } from "@/planning";

/** Days after last spring frost before we prefer fall planning. */
const SPRING_WINDOW_DAYS = 30;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Next actionable garden season from frost anchors.
 * Spring until ~30d past last spring frost; fall until first fall frost; else next spring.
 */
export function suggestSeasonFromFrost(input: {
  now?: Date;
  lastSpringFrostP50: Date;
  firstFallFrostP50: Date | null | undefined;
}): GardenSeason {
  const now = startOfDay(input.now ?? new Date());
  const springEnd = startOfDay(addDays(input.lastSpringFrostP50, SPRING_WINDOW_DAYS));
  if (now < springEnd) return "spring";

  const fallFrost = input.firstFallFrostP50
    ? startOfDay(input.firstFallFrostP50)
    : null;
  if (fallFrost && now < fallFrost) return "fall";
  return "spring";
}

export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
