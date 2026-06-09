import type { RiskProfile } from "@/planning";

export type ScheduleTask = {
  cropId: string;
  type: string;
  date: string;
  label: string;
};

export type ScheduleResult = {
  zone: string;
  zip?: string;
  lastFrostDate: string;
  frostSource: string;
  frostProvenance: string;
  lastFrostP10?: string;
  lastFrostP50?: string;
  lastFrostP90?: string;
  climateDataVersion?: string;
  riskProfile: RiskProfile;
  tasks: ScheduleTask[];
  sowDates: { seed: string; date: string }[];
};
