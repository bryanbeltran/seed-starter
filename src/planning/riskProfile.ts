import { addDays } from "date-fns";
import type { RiskProfile } from "./types";

/** Days to shift last-frost anchor: later spring = conservative. */
const FROST_SHIFT_DAYS: Record<RiskProfile, number> = {
  conservative: 7,
  balanced: 0,
  aggressive: -7,
};

export function shiftFrostDate(
  frostDate: Date,
  profile: RiskProfile,
): Date {
  return addDays(frostDate, FROST_SHIFT_DAYS[profile]);
}

export const riskProfiles: RiskProfile[] = [
  "conservative",
  "balanced",
  "aggressive",
];
