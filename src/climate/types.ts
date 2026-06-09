export type ClimateRecord = {
  zip: string;
  zone?: string;
  stationId: string;
  stationName: string;
  distanceKm: number;
  lastFrostP10: string;
  lastFrostP50: string;
  lastFrostP90: string;
  yearsSampled: number;
  provenance: string;
  dataVersion: string;
  method: string;
};

export type ClimateRepository = {
  getByZip(zip: string): ClimateRecord | undefined;
};

export type ClimateManifest = {
  dataVersion: string;
  zipCount: number;
  skippedCount: number;
  stationPoolCount: number;
  tminStationCount: number;
  zoneFillRate: number;
  medianDistanceKm: number;
  p95DistanceKm: number;
  maxDistanceKm: number;
  computedAt: string;
};
