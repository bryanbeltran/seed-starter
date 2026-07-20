import type { CropDefinition } from "./catalogSchema";
import type { GardenSeason } from "./types";

export type SchedulingRules = {
  method: CropDefinition["method"];
  indoorSowOffsetDays?: number;
  hardenOffDaysBeforeTransplant?: number;
  transplantDaysAfterFrost?: number;
  directSowDaysBeforeFrost?: number;
  daysToHarvest: number;
  successionIntervalDays?: number;
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
      successionIntervalDays: spring.successionIntervalDays,
    };
  }

  return {
    method: "direct",
    directSowDaysBeforeFrost:
      spring.directSowDaysBeforeAnchor ?? crop.directSowDaysBeforeFrost,
    daysToHarvest: crop.daysToHarvest,
    successionIntervalDays: spring.successionIntervalDays,
  };
}

/**
 * Fall timing from catalog `seasons.fall` anchored on `firstFallFrost`.
 * Offsets relative to first fall frost (transplant after-anchor usually negative).
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

/**
 * Summer timing from catalog `seasons.summer` anchored on `lastSpringFrost`
 * with later offsets (typically sow/transplant well after frost). No GDD.
 */
export function summerRulesFromCrop(crop: CropDefinition): SchedulingRules {
  const summer = crop.seasons?.summer;
  if (!summer || summer.anchor !== "lastSpringFrost") {
    return flatRules(crop);
  }

  if (summer.method === "transplant") {
    return {
      method: "transplant",
      indoorSowOffsetDays: summer.indoorSowOffsetDays ?? crop.indoorSowOffsetDays,
      hardenOffDaysBeforeTransplant:
        summer.hardenOffDaysBeforeTransplant ?? crop.hardenOffDaysBeforeTransplant,
      transplantDaysAfterFrost:
        summer.transplantDaysAfterAnchor ?? crop.transplantDaysAfterFrost,
      daysToHarvest: crop.daysToHarvest,
      successionIntervalDays: summer.successionIntervalDays,
    };
  }

  return {
    method: "direct",
    directSowDaysBeforeFrost:
      summer.directSowDaysBeforeAnchor ?? crop.directSowDaysBeforeFrost,
    daysToHarvest: crop.daysToHarvest,
    successionIntervalDays: summer.successionIntervalDays,
  };
}

export function rulesFromCrop(
  crop: CropDefinition,
  season: GardenSeason = "spring",
): SchedulingRules {
  if (season === "fall") return fallRulesFromCrop(crop);
  if (season === "summer") return summerRulesFromCrop(crop);
  return springRulesFromCrop(crop);
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
