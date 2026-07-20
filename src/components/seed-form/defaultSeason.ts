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

/** Month-day key (MMDD) so year from resolveFrost (next occurrence) does not skew the cycle. */
function mdKey(d: Date): number {
  return (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Next actionable garden season from frost anchors.
 * Spring until ~30d past last spring frost; fall until first fall frost; else next spring.
 * Compares month-day only — climate dates may be next calendar year.
 */
export function suggestSeasonFromFrost(input: {
  now?: Date;
  lastSpringFrostP50: Date;
  firstFallFrostP50: Date | null | undefined;
}): GardenSeason {
  const now = startOfDay(input.now ?? new Date());
  const springEnd = addDays(
    new Date(2000, input.lastSpringFrostP50.getMonth(), input.lastSpringFrostP50.getDate()),
    SPRING_WINDOW_DAYS,
  );
  const springEndMd = mdKey(springEnd);
  const nowMd = mdKey(now);

  if (nowMd < springEndMd) return "spring";

  if (input.firstFallFrostP50) {
    const fallMd = mdKey(input.firstFallFrostP50);
    if (nowMd < fallMd) return "fall";
  }

  return "spring";
}

export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
