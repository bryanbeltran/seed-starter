import { addDays, subDays } from "date-fns";
import plantsData from "../../data/natives/plants.json";
import ecoregionPlantsData from "../../data/natives/ecoregion-plants.json";
import { lookupZipEcoregion, type EcoregionRef } from "./lookupEcoregion";
import {
  ecoregionPlantsFileSchema,
  nativesFileSchema,
  type NativePlant,
} from "./schema";
import { resolveFrost } from "@/planning/frostResolver";
import type { FrostClimateLookup, GardenSeason } from "@/planning/types";

const plantsFile = nativesFileSchema.parse(plantsData);
const ecoregionFile = ecoregionPlantsFileSchema.parse(ecoregionPlantsData);

export type NativeTask = {
  type: "direct_sow" | "indoor_sow" | "transplant" | "fall_sow";
  date: Date;
  label: string;
};

export type NativePlantResult = NativePlant & {
  tasks: NativeTask[];
};

export type ResolveNativesResult = {
  zip: string;
  zone: string;
  season: GardenSeason;
  ecoregion: EcoregionRef | null;
  lastFrostDate: Date;
  frostSource: string;
  frostProvenance: string;
  plants: NativePlantResult[];
  catalogCoverage: "full" | "none" | "unknown";
};

function tasksForPlant(
  plant: NativePlant,
  frost: Date,
  season: GardenSeason,
): NativeTask[] {
  if (season === "fall") {
    if (!plant.fallDormant && !plant.needsStratification) {
      return [];
    }
    const before = plant.fallSowDaysBeforeFrost ?? 14;
    return [
      {
        type: "fall_sow",
        date: subDays(frost, before),
        label: `Fall dormant sow ${plant.commonName}`,
      },
    ];
  }

  const tasks: NativeTask[] = [];
  if (plant.method === "transplant") {
    const transplant = addDays(frost, plant.transplantDaysAfterFrost ?? 0);
    const indoor = subDays(frost, plant.indoorSowOffsetDays ?? 30);
    tasks.push({
      type: "indoor_sow",
      date: indoor,
      label: `Sow ${plant.commonName} indoors`,
    });
    tasks.push({
      type: "transplant",
      date: transplant,
      label: `Transplant ${plant.commonName}`,
    });
    return tasks;
  }

  if (plant.stratificationDays != null) {
    tasks.push({
      type: "direct_sow",
      date: subDays(frost, plant.stratificationDays),
      label: `Direct sow ${plant.commonName} (cold stratification window)`,
    });
    return tasks;
  }

  const before = plant.directSowDaysBeforeFrost ?? 0;
  tasks.push({
    type: "direct_sow",
    date: subDays(frost, before),
    label: `Direct sow ${plant.commonName}`,
  });
  return tasks;
}

export function resolveNatives(input: {
  zip: string;
  zone: string;
  season?: GardenSeason;
  referenceDate?: Date;
  climateLookup?: FrostClimateLookup;
}): ResolveNativesResult {
  const season: GardenSeason = input.season === "fall" ? "fall" : "spring";
  const ecoregion = lookupZipEcoregion(input.zip);
  const frost = resolveFrost(
    {
      zone: input.zone,
      zip: input.zip,
      referenceDate: input.referenceDate,
      season,
    },
    input.climateLookup,
  );

  const base = {
    zip: input.zip,
    zone: input.zone,
    season,
    lastFrostDate: frost.lastFrostDate,
    frostSource: frost.source,
    frostProvenance: frost.provenance,
  };

  if (!ecoregion) {
    return {
      ...base,
      ecoregion: null,
      plants: [],
      catalogCoverage: "unknown",
    };
  }

  const listing = ecoregionFile.ecoregions[ecoregion.id];
  if (!listing?.plantIds.length) {
    return {
      ...base,
      ecoregion: { id: ecoregion.id, name: ecoregion.name },
      plants: [],
      catalogCoverage: "none",
    };
  }

  const plants: NativePlantResult[] = listing.plantIds
    .map((id) => plantsFile.plants[id])
    .filter(Boolean)
    .map((plant) => ({
      ...plant,
      tasks: tasksForPlant(plant, frost.lastFrostDate, season),
    }))
    .filter((p) => p.tasks.length > 0);

  return {
    ...base,
    ecoregion: { id: ecoregion.id, name: listing.name || ecoregion.name },
    plants,
    catalogCoverage: "full",
  };
}
