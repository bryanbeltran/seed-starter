export type RiskProfile = "conservative" | "balanced" | "aggressive";

export type GardenSeason = "spring" | "fall" | "summer";

export type FrostModelSource = "climate" | "station" | "regional" | "zone";

export type Location = {
  zip: string;
  zone: string;
};

export type CropSelection = {
  cropId: string;
  varietyId?: string;
};

export type TaskType =
  | "indoor_sow"
  | "harden_off"
  | "transplant"
  | "direct_sow"
  | "succession_sow"
  | "fall_sow"
  | "harvest";

export type PlantingTask = {
  cropId: string;
  type: TaskType;
  date: Date;
  label: string;
};

export type ClimateConfidence = "high" | "medium" | "low";

export type FrostClimateRecord = {
  lastFrostP10: string;
  lastFrostP50: string;
  lastFrostP90: string;
  firstFallFrostP10?: string;
  firstFallFrostP50?: string;
  firstFallFrostP90?: string;
  provenance: string;
  dataVersion: string;
  stationId?: string;
  stationName?: string;
  distanceKm?: number;
};

export type FrostClimateLookup = {
  getByZip(zip: string): FrostClimateRecord | undefined;
};

export type FrostPercentiles = {
  p10: Date;
  p50: Date;
  p90: Date;
};

export type Schedule = {
  zone: string;
  zip?: string;
  season: GardenSeason;
  /** Season anchor date: last spring frost or first fall frost. */
  lastFrostDate: Date;
  frostSource: FrostModelSource;
  frostProvenance: string;
  frostPercentiles?: FrostPercentiles;
  climateDataVersion?: string;
  climateConfidence?: ClimateConfidence;
  stationDistanceKm?: number;
  riskProfile: RiskProfile;
  tasks: PlantingTask[];
};

export type ScheduleInput = {
  zone: string;
  zip?: string;
  crops: string[];
  cropSelections?: CropSelection[];
  riskProfile?: RiskProfile;
  season?: GardenSeason;
  referenceDate?: Date;
  climateRepository?: FrostClimateLookup;
};
