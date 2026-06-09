import { addDays } from "date-fns";
import type { FrostResolution } from "./frostResolver";
import type { RiskProfile } from "./types";

/** Days to shift last-frost anchor when percentile data is unavailable. */
const FROST_SHIFT_DAYS: Record<RiskProfile, number> = {
  conservative: 7,
  balanced: 0,
  aggressive: -7,
};

export function shiftFrostDate(frostDate: Date, profile: RiskProfile): Date {
  return addDays(frostDate, FROST_SHIFT_DAYS[profile]);
}

export function selectFrostDate(
  resolution: FrostResolution,
  profile: RiskProfile,
): Date {
  if (resolution.lastFrostP10 && resolution.lastFrostP90) {
    if (profile === "conservative") return resolution.lastFrostP90;
    if (profile === "aggressive") return resolution.lastFrostP10;
    return resolution.lastFrostDate;
  }
  return shiftFrostDate(resolution.lastFrostDate, profile);
}

export const riskProfiles: RiskProfile[] = [
  "conservative",
  "balanced",
  "aggressive",
];
