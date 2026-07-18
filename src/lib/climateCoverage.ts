import zipClimateData from "../../data/zipClimate.json";
import climateManifest from "../../data/climate-manifest.json";
import {
  CONFIDENCE_HIGH_KM,
  CONFIDENCE_MEDIUM_KM,
  OUTLIER_DISTANCE_KM,
  climateConfidence,
} from "./climateConfidence";
import type { ClimateRecord } from "@/climate";

const records = zipClimateData as Record<string, ClimateRecord>;

export function computeCoverageStats() {
  let high = 0;
  let medium = 0;
  let low = 0;
  let outliers = 0;
  let withZone = 0;

  for (const record of Object.values(records)) {
    if (record.zone) withZone += 1;
    if (record.distanceKm > OUTLIER_DISTANCE_KM) {
      outliers += 1;
      continue;
    }
    const c = climateConfidence(record.distanceKm);
    if (c === "high") high += 1;
    else if (c === "medium") medium += 1;
    else low += 1;
  }

  const usable = high + medium + low;
  return {
    manifest: climateManifest,
    thresholds: {
      highKm: CONFIDENCE_HIGH_KM,
      mediumKm: CONFIDENCE_MEDIUM_KM,
      outlierKm: OUTLIER_DISTANCE_KM,
    },
    usable,
    outliers,
    confidence: { high, medium, low },
    zoneFillUsable: usable ? withZone / Object.keys(records).length : 0,
  };
}
