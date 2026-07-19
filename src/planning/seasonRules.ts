import type { CropDefinition } from "./catalogSchema";
import type { GardenSeason } from "./types";

export type SchedulingRules = {
  method: CropDefinition["method"];
  indoorSowOffsetDays?: number;
  hardenOffDaysBeforeTransplant?: number;
  transplantDaysAfterFrost?: number;
  directSowDaysBeforeFrost?: number;
  daysToHarvest: number;
};

/** Spring timing from catalog `seasons.spring`, falling back to top-level crop fields. */
export function springRulesFromCrop(crop: CropDefinition): SchedulingRules {
  const spring = crop.seasons?.spring;
  if (!spring || spring.anchor !== "lastSpringFrost") {
    return flatRules(crop);
  }

  if (spring.method === "transplant") {
    return {
      method: "transplant",
      indoorSowOffsetDays: spring.indoorSowOffsetDays ?? crop.indoorSowOffsetDays,
      hardenOffDaysBeforeTransplant:
        spring.hardenOffDaysBeforeTransplant ?? crop.hardenOffDaysBeforeTransplant,
      transplantDaysAfterFrost:
        spring.transplantDaysAfterAnchor ?? crop.transplantDaysAfterFrost,
      daysToHarvest: crop.daysToHarvest,
    };
  }

  return {
    method: "direct",
    directSowDaysBeforeFrost:
      spring.directSowDaysBeforeAnchor ?? crop.directSowDaysBeforeFrost,
    daysToHarvest: crop.daysToHarvest,
  };
}

/**
 * Fall timing from catalog `seasons.fall` anchored on `firstFallFrost`.
 * Offsets are interpreted relative to the first fall frost:
 * - `transplantDaysAfterAnchor` is typically negative (transplant before frost).
 * - `directSowDaysBeforeAnchor` counts days back from frost (positive).
 * - `indoorSowOffsetDays` counts days back from frost.
 */
export function fallRulesFromCrop(crop: CropDefinition): SchedulingRules {
  const fall = crop.seasons?.fall;
  if (!fall || fall.anchor !== "firstFallFrost") {
    return flatRules(crop);
  }

  if (fall.method === "transplant") {
    return {
      method: "transplant",
      indoorSowOffsetDays: fall.indoorSowOffsetDays ?? crop.indoorSowOffsetDays,
      hardenOffDaysBeforeTransplant:
        fall.hardenOffDaysBeforeTransplant ?? crop.hardenOffDaysBeforeTransplant,
      transplantDaysAfterFrost:
        fall.transplantDaysAfterAnchor ?? crop.transplantDaysAfterFrost,
      daysToHarvest: crop.daysToHarvest,
    };
  }

  return {
    method: "direct",
    directSowDaysBeforeFrost:
      fall.directSowDaysBeforeAnchor ?? crop.directSowDaysBeforeFrost,
    daysToHarvest: crop.daysToHarvest,
  };
}

export function rulesFromCrop(
  crop: CropDefinition,
  season: GardenSeason = "spring",
): SchedulingRules {
  return season === "fall" ? fallRulesFromCrop(crop) : springRulesFromCrop(crop);
}

function flatRules(crop: CropDefinition): SchedulingRules {
  return {
    method: crop.method,
    indoorSowOffsetDays: crop.indoorSowOffsetDays,
    hardenOffDaysBeforeTransplant: crop.hardenOffDaysBeforeTransplant,
    transplantDaysAfterFrost: crop.transplantDaysAfterFrost,
    directSowDaysBeforeFrost: crop.directSowDaysBeforeFrost,
    daysToHarvest: crop.daysToHarvest,
  };
}
