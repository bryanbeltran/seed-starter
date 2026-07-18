export type ClimateConfidence = "high" | "medium" | "low";

/** Station distance thresholds (km) for frost confidence. */
export const CONFIDENCE_HIGH_KM = 25;
export const CONFIDENCE_MEDIUM_KM = 60;
/** Beyond this, climate tier is rejected → fallback chain. */
export const OUTLIER_DISTANCE_KM = 200;

export function climateConfidence(distanceKm: number | undefined): ClimateConfidence {
  if (distanceKm == null || Number.isNaN(distanceKm)) return "low";
  if (distanceKm <= CONFIDENCE_HIGH_KM) return "high";
  if (distanceKm <= CONFIDENCE_MEDIUM_KM) return "medium";
  return "low";
}

export function isClimateOutlier(distanceKm: number | undefined): boolean {
  return distanceKm != null && distanceKm > OUTLIER_DISTANCE_KM;
}
