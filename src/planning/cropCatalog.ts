export type VarietyDefinition = {
  id: string;
  name: string;
  indoorSowOffsetDays?: number;
  daysToHarvest?: number;
};

export type CropMethod = "transplant" | "direct";

export type CropDefinition = {
  id: string;
  name: string;
  method: CropMethod;
  indoorSowOffsetDays?: number;
  hardenOffDaysBeforeTransplant?: number;
  transplantDaysAfterFrost?: number;
  directSowDaysBeforeFrost?: number;
  daysToHarvest: number;
  varieties?: Record<string, VarietyDefinition>;
};

const crops: Record<string, CropDefinition> = {
  tomato: {
    id: "tomato",
    name: "Tomato",
    method: "transplant",
    indoorSowOffsetDays: 56,
    hardenOffDaysBeforeTransplant: 7,
    transplantDaysAfterFrost: 0,
    daysToHarvest: 75,
    varieties: {
      cherry: { id: "cherry", name: "Cherry", daysToHarvest: 65 },
      beefsteak: { id: "beefsteak", name: "Beefsteak", daysToHarvest: 85 },
      roma: { id: "roma", name: "Roma", daysToHarvest: 75 },
      heirloom: { id: "heirloom", name: "Heirloom", daysToHarvest: 80 },
    },
  },
  pepper: {
    id: "pepper",
    name: "Pepper",
    method: "transplant",
    indoorSowOffsetDays: 56,
    hardenOffDaysBeforeTransplant: 7,
    transplantDaysAfterFrost: 14,
    daysToHarvest: 70,
    varieties: {
      bell: { id: "bell", name: "Bell", daysToHarvest: 75 },
      jalapeno: { id: "jalapeno", name: "Jalapeño", daysToHarvest: 70 },
      habanero: { id: "habanero", name: "Habanero", indoorSowOffsetDays: 70, daysToHarvest: 90 },
    },
  },
  lettuce: {
    id: "lettuce",
    name: "Lettuce",
    method: "transplant",
    indoorSowOffsetDays: 30,
    hardenOffDaysBeforeTransplant: 5,
    transplantDaysAfterFrost: -14,
    daysToHarvest: 45,
    varieties: {
      butterhead: { id: "butterhead", name: "Butterhead", daysToHarvest: 45 },
      romaine: { id: "romaine", name: "Romaine", daysToHarvest: 55 },
      leaf: { id: "leaf", name: "Leaf", daysToHarvest: 40 },
    },
  },
  carrot: {
    id: "carrot",
    name: "Carrot",
    method: "direct",
    directSowDaysBeforeFrost: 14,
    daysToHarvest: 70,
    varieties: {
      nantes: { id: "nantes", name: "Nantes", daysToHarvest: 65 },
    },
  },
  broccoli: {
    id: "broccoli",
    name: "Broccoli",
    method: "transplant",
    indoorSowOffsetDays: 84,
    hardenOffDaysBeforeTransplant: 7,
    transplantDaysAfterFrost: -14,
    daysToHarvest: 60,
    varieties: {
      calabrese: { id: "calabrese", name: "Calabrese", daysToHarvest: 60 },
    },
  },
  beans: {
    id: "beans",
    name: "Beans",
    method: "direct",
    directSowDaysBeforeFrost: 0,
    daysToHarvest: 55,
    varieties: {
      bush: { id: "bush", name: "Bush", daysToHarvest: 50 },
      pole: { id: "pole", name: "Pole", daysToHarvest: 65 },
    },
  },
  cucumber: {
    id: "cucumber",
    name: "Cucumber",
    method: "transplant",
    indoorSowOffsetDays: 21,
    hardenOffDaysBeforeTransplant: 5,
    transplantDaysAfterFrost: 7,
    daysToHarvest: 55,
    varieties: {
      slicing: { id: "slicing", name: "Slicing", daysToHarvest: 55 },
      pickling: { id: "pickling", name: "Pickling", daysToHarvest: 50 },
    },
  },
  peas: {
    id: "peas",
    name: "Peas",
    method: "direct",
    directSowDaysBeforeFrost: 28,
    daysToHarvest: 60,
    varieties: {
      snap: { id: "snap", name: "Snap", daysToHarvest: 60 },
      shell: { id: "shell", name: "Shell", daysToHarvest: 65 },
    },
  },
  spinach: {
    id: "spinach",
    name: "Spinach",
    method: "direct",
    directSowDaysBeforeFrost: 42,
    daysToHarvest: 40,
    varieties: {
      baby: { id: "baby", name: "Baby", daysToHarvest: 35 },
    },
  },
  basil: {
    id: "basil",
    name: "Basil",
    method: "transplant",
    indoorSowOffsetDays: 35,
    hardenOffDaysBeforeTransplant: 5,
    transplantDaysAfterFrost: 7,
    daysToHarvest: 45,
    varieties: {
      genovese: { id: "genovese", name: "Genovese", daysToHarvest: 45 },
      thai: { id: "thai", name: "Thai", daysToHarvest: 50 },
    },
  },
  kale: {
    id: "kale",
    name: "Kale",
    method: "transplant",
    indoorSowOffsetDays: 42,
    hardenOffDaysBeforeTransplant: 5,
    transplantDaysAfterFrost: -21,
    daysToHarvest: 55,
    varieties: {
      lacinato: { id: "lacinato", name: "Lacinato", daysToHarvest: 55 },
      curly: { id: "curly", name: "Curly", daysToHarvest: 50 },
    },
  },
};

export const cropIds = Object.keys(crops);

export function getCrop(cropId: string): CropDefinition | undefined {
  return crops[cropId];
}

export function getCropOrDefault(cropId: string): CropDefinition {
  return (
    crops[cropId] ?? {
      id: cropId,
      name: cropId.charAt(0).toUpperCase() + cropId.slice(1),
      method: "transplant",
      indoorSowOffsetDays: 30,
      hardenOffDaysBeforeTransplant: 5,
      transplantDaysAfterFrost: 0,
      daysToHarvest: 60,
    }
  );
}

export function resolveCropRules(
  cropId: string,
  varietyId?: string,
): CropDefinition & { varietyName?: string } {
  const base = getCropOrDefault(cropId);
  if (!varietyId || !base.varieties?.[varietyId]) {
    return base;
  }
  const variety = base.varieties[varietyId];
  return {
    ...base,
    indoorSowOffsetDays: variety.indoorSowOffsetDays ?? base.indoorSowOffsetDays,
    daysToHarvest: variety.daysToHarvest ?? base.daysToHarvest,
    varietyName: variety.name,
  };
}

export function listCrops(): CropDefinition[] {
  return Object.values(crops);
}

export function varietyCount(): number {
  return listCrops().reduce(
    (n, c) => n + Object.keys(c.varieties ?? {}).length,
    0,
  );
}
