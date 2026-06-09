export type RiskProfile = "conservative" | "balanced" | "aggressive";

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
  lastFrostDate: Date;
  riskProfile: RiskProfile;
  tasks: PlantingTask[];
};

export type ScheduleInput = {
  zone: string;
  crops: string[];
  riskProfile?: RiskProfile;
  /** Override "today" for deterministic tests and season roll-forward. */
  referenceDate?: Date;
};
