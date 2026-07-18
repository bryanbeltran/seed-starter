/** Default spring timing by crop — confidence: low when inferred from category only */
const DEFAULTS = {
  tomato: {
    method: "transplant",
    indoorSowOffsetDays: 56,
    hardenOffDaysBeforeTransplant: 7,
    transplantDaysAfterFrost: 0,
    daysToHarvest: 75,
  },
  pepper: {
    method: "transplant",
    indoorSowOffsetDays: 56,
    hardenOffDaysBeforeTransplant: 7,
    transplantDaysAfterFrost: 14,
    daysToHarvest: 70,
  },
  eggplant: {
    method: "transplant",
    indoorSowOffsetDays: 56,
    hardenOffDaysBeforeTransplant: 7,
    transplantDaysAfterFrost: 14,
    daysToHarvest: 75,
  },
  carrot: {
    method: "direct",
    directSowDaysBeforeFrost: 14,
    daysToHarvest: 70,
  },
  lettuce: {
    method: "transplant",
    indoorSowOffsetDays: 30,
    hardenOffDaysBeforeTransplant: 5,
    transplantDaysAfterFrost: -14,
    daysToHarvest: 45,
  },
  broccoli: {
    method: "transplant",
    indoorSowOffsetDays: 84,
    hardenOffDaysBeforeTransplant: 7,
    transplantDaysAfterFrost: -14,
    daysToHarvest: 60,
  },
  kale: {
    method: "transplant",
    indoorSowOffsetDays: 42,
    hardenOffDaysBeforeTransplant: 5,
    transplantDaysAfterFrost: -21,
    daysToHarvest: 55,
  },
  cabbage: {
    method: "transplant",
    indoorSowOffsetDays: 70,
    hardenOffDaysBeforeTransplant: 7,
    transplantDaysAfterFrost: -14,
    daysToHarvest: 75,
  },
  cauliflower: {
    method: "transplant",
    indoorSowOffsetDays: 70,
    hardenOffDaysBeforeTransplant: 7,
    transplantDaysAfterFrost: -14,
    daysToHarvest: 70,
  },
  cucumber: {
    method: "transplant",
    indoorSowOffsetDays: 21,
    hardenOffDaysBeforeTransplant: 5,
    transplantDaysAfterFrost: 7,
    daysToHarvest: 55,
  },
  melon: {
    method: "transplant",
    indoorSowOffsetDays: 28,
    hardenOffDaysBeforeTransplant: 5,
    transplantDaysAfterFrost: 14,
    daysToHarvest: 85,
  },
  watermelon: {
    method: "transplant",
    indoorSowOffsetDays: 28,
    hardenOffDaysBeforeTransplant: 5,
    transplantDaysAfterFrost: 14,
    daysToHarvest: 90,
  },
  "squash-summer": {
    method: "direct",
    directSowDaysBeforeFrost: 7,
    daysToHarvest: 55,
  },
  "squash-winter": {
    method: "direct",
    directSowDaysBeforeFrost: 14,
    daysToHarvest: 100,
  },
  pumpkin: {
    method: "direct",
    directSowDaysBeforeFrost: 14,
    daysToHarvest: 100,
  },
  corn: {
    method: "direct",
    directSowDaysBeforeFrost: 0,
    daysToHarvest: 75,
  },
  beans: {
    method: "direct",
    directSowDaysBeforeFrost: 0,
    daysToHarvest: 55,
  },
  pea: {
    method: "direct",
    directSowDaysBeforeFrost: 28,
    daysToHarvest: 60,
  },
  carrot: {
    method: "direct",
    directSowDaysBeforeFrost: 14,
    daysToHarvest: 70,
  },
  beet: {
    method: "direct",
    directSowDaysBeforeFrost: 14,
    daysToHarvest: 55,
  },
  radish: {
    method: "direct",
    directSowDaysBeforeFrost: 28,
    daysToHarvest: 30,
  },
  spinach: {
    method: "direct",
    directSowDaysBeforeFrost: 42,
    daysToHarvest: 40,
  },
  onion: {
    method: "transplant",
    indoorSowOffsetDays: 56,
    hardenOffDaysBeforeTransplant: 7,
    transplantDaysAfterFrost: -28,
    daysToHarvest: 100,
  },
  leek: {
    method: "transplant",
    indoorSowOffsetDays: 70,
    hardenOffDaysBeforeTransplant: 7,
    transplantDaysAfterFrost: -28,
    daysToHarvest: 120,
  },
  garlic: {
    method: "direct",
    directSowDaysBeforeFrost: 21,
    daysToHarvest: 240,
  },
  basil: {
    method: "transplant",
    indoorSowOffsetDays: 35,
    hardenOffDaysBeforeTransplant: 5,
    transplantDaysAfterFrost: 7,
    daysToHarvest: 45,
  },
  herb: {
    method: "transplant",
    indoorSowOffsetDays: 42,
    hardenOffDaysBeforeTransplant: 5,
    transplantDaysAfterFrost: 7,
    daysToHarvest: 60,
  },
  greens: {
    method: "direct",
    directSowDaysBeforeFrost: 21,
    daysToHarvest: 40,
  },
  "asian-greens": {
    method: "direct",
    directSowDaysBeforeFrost: 14,
    daysToHarvest: 45,
  },
  potato: {
    method: "direct",
    directSowDaysBeforeFrost: 14,
    daysToHarvest: 90,
  },
  grain: {
    method: "direct",
    directSowDaysBeforeFrost: 7,
    daysToHarvest: 90,
  },
};

const GENERIC = {
  method: "direct",
  directSowDaysBeforeFrost: 0,
  daysToHarvest: 60,
};

export function cropDefaults(cropId) {
  return DEFAULTS[cropId] ?? GENERIC;
}

export function springSeason(block) {
  const anchor = "lastSpringFrost";
  if (block.method === "transplant") {
    return {
      anchor,
      method: "transplant",
      indoorSowOffsetDays: block.indoorSowOffsetDays,
      hardenOffDaysBeforeTransplant: block.hardenOffDaysBeforeTransplant,
      transplantDaysAfterAnchor: block.transplantDaysAfterFrost ?? 0,
    };
  }
  return {
    anchor,
    method: "direct",
    directSowDaysBeforeAnchor: block.directSowDaysBeforeFrost ?? 0,
  };
}
