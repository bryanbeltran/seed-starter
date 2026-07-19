import type { GardenSeason, RiskProfile } from "@/planning";

export type ScheduleTask = {
  cropId: string;
  type: string;
  date: string;
  label: string;
};

export type ScheduleResult = {
  zone: string;
  zip?: string;
  season?: GardenSeason;
  lastFrostDate: string;
  frostSource: string;
  frostProvenance: string;
  lastFrostP10?: string;
  lastFrostP50?: string;
  lastFrostP90?: string;
  climateDataVersion?: string;
  climateConfidence?: "high" | "medium" | "low";
  stationDistanceKm?: number;
  riskProfile: RiskProfile;
  tasks: ScheduleTask[];
  sowDates: { seed: string; date: string }[];
};
