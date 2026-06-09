export type RiskProfile = "conservative" | "balanced" | "aggressive";

export type FrostModelSource = "station" | "regional" | "zone";

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

export type Schedule = {
  zone: string;
  zip?: string;
  lastFrostDate: Date;
  frostSource: FrostModelSource;
  frostProvenance: string;
  riskProfile: RiskProfile;
  tasks: PlantingTask[];
};

export type ScheduleInput = {
  zone: string;
  zip?: string;
  crops: string[];
  cropSelections?: CropSelection[];
  riskProfile?: RiskProfile;
  referenceDate?: Date;
};
