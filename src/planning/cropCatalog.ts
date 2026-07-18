import catalogData from "../../data/catalog/crops.json";
import {
  catalogFileSchema,
  type CropDefinition,
  type VarietyDefinition,
} from "./catalogSchema";
import { springRulesFromCrop } from "./seasonRules";

export type { CropDefinition, VarietyDefinition };
export type CropMethod = CropDefinition["method"];

const parsed = catalogFileSchema.safeParse(catalogData);
if (!parsed.success) {
  throw new Error(`Invalid catalog: ${parsed.error.message}`);
}

const catalogFile = parsed.data;
const crops: Record<string, CropDefinition> = catalogFile.crops;

export const cropIds = Object.keys(crops);

export function getCrop(cropId: string): CropDefinition | undefined {
  return crops[cropId];
}

export function getCropName(cropId: string): string {
  return crops[cropId]?.name ?? cropId;
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
  const timing = springRulesFromCrop(base);
  const merged = { ...base, ...timing };
  if (!varietyId || !base.varieties?.[varietyId]) {
    return merged;
  }
  const variety = base.varieties[varietyId];
  return {
    ...merged,
    indoorSowOffsetDays: variety.indoorSowOffsetDays ?? merged.indoorSowOffsetDays,
    daysToHarvest: variety.daysToHarvest ?? merged.daysToHarvest,
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

export function catalogMeta() {
  return {
    version: catalogFile.version,
    generatedAt: catalogFile.generatedAt,
    cropCount: cropIds.length,
    varietyCount: varietyCount(),
  };
}
