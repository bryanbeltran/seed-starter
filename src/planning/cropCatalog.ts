export type CropDefinition = {
  id: string;
  name: string;
  /** Days before last frost to start indoors. */
  indoorSowOffsetDays: number;
};

const crops: Record<string, CropDefinition> = {
  tomato: { id: "tomato", name: "Tomato", indoorSowOffsetDays: 56 },
  pepper: { id: "pepper", name: "Pepper", indoorSowOffsetDays: 56 },
  lettuce: { id: "lettuce", name: "Lettuce", indoorSowOffsetDays: 30 },
  carrot: { id: "carrot", name: "Carrot", indoorSowOffsetDays: 14 },
  broccoli: { id: "broccoli", name: "Broccoli", indoorSowOffsetDays: 84 },
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
      indoorSowOffsetDays: 30,
    }
  );
}

export function listCrops(): CropDefinition[] {
  return Object.values(crops);
}
