import type { CropDefinition } from "./catalogSchema";

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
