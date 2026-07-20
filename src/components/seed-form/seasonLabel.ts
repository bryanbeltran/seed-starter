import type { GardenSeason } from "@/planning";

export function seasonDisplayLabel(season: GardenSeason | string | undefined): string {
  if (season === "fall") return "Fall";
  if (season === "summer") return "Summer";
  return "Spring";
}

export function seasonSlug(season: GardenSeason | string | undefined): string {
  if (season === "fall") return "fall";
  if (season === "summer") return "summer";
  return "spring";
}
