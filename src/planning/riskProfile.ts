import { addDays } from "date-fns";
import type { FrostResolution } from "./frostResolver";
import type { GardenSeason, RiskProfile } from "./types";

/**
 * Days to shift last-frost anchor when percentile data is unavailable.
 * Spring: conservative → later (safer, wait longer for warmth).
 * Fall: inverted — conservative → earlier (safer, prepare for first frost sooner).
 */
const SPRING_SHIFT_DAYS: Record<RiskProfile, number> = {
  conservative: 7,
  balanced: 0,
  aggressive: -7,
};

const FALL_SHIFT_DAYS: Record<RiskProfile, number> = {
  conservative: -7,
  balanced: 0,
  aggressive: 7,
};

export function shiftFrostDate(
  frostDate: Date,
  profile: RiskProfile,
  season: GardenSeason = "spring",
): Date {
  const table = season === "fall" ? FALL_SHIFT_DAYS : SPRING_SHIFT_DAYS;
  return addDays(frostDate, table[profile]);
}

/**
 * Pick the season-appropriate frost date given a risk profile.
 * Spring: conservative→p90 (later), aggressive→p10 (earlier).
 * Fall: inverted — conservative→p10 (earlier fall frost), aggressive→p90 (later).
 */
export function selectFrostDate(
  resolution: FrostResolution,
  profile: RiskProfile,
  season?: GardenSeason,
): Date {
  const s: GardenSeason = season ?? resolution.season ?? "spring";
  if (resolution.lastFrostP10 && resolution.lastFrostP90) {
    if (profile === "balanced") return resolution.lastFrostDate;
    if (s === "fall") {
      return profile === "conservative"
        ? resolution.lastFrostP10
        : resolution.lastFrostP90;
    }
    return profile === "conservative"
      ? resolution.lastFrostP90
      : resolution.lastFrostP10;
  }
  return shiftFrostDate(resolution.lastFrostDate, profile, s);
}

export const riskProfiles: RiskProfile[] = [
  "conservative",
  "balanced",
  "aggressive",
];
