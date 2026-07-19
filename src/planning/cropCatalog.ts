import catalogData from "../../data/catalog/crops.json";
import {
  catalogFileSchema,
  type CropDefinition,
  type VarietyDefinition,
} from "./catalogSchema";
import { rulesFromCrop } from "./seasonRules";
import type { GardenSeason } from "./types";

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
  season: GardenSeason = "spring",
): CropDefinition & { varietyName?: string } {
  const base = getCropOrDefault(cropId);
  const timing = rulesFromCrop(base, season);
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

/**
 * Whether a crop can be planted in a given season.
 * Spring is permissive (any catalog crop); other seasons require an
 * explicit `seasons[season]` entry.
 */
export function cropSupportsSeason(
  crop: CropDefinition,
  season: GardenSeason,
): boolean {
  if (season === "spring") return true;
  return Boolean(crop.seasons?.[season]);
}

/** Catalog crop ids that support a given season. */
export function cropIdsForSeason(season: GardenSeason): string[] {
  return listCrops()
    .filter((c) => cropSupportsSeason(c, season))
    .map((c) => c.id);
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
