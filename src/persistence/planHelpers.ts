import { getFileClimateRepository, isClimateVersionStale } from "@/climate";
import type { RiskProfile, Schedule } from "@/planning";
import { buildSchedule } from "@/planning";
import { serializeSchedule } from "@/lib/serializeSchedule";

export type SavedPlanInput = {
  name: string;
  zip: string;
  crops: string[];
  riskProfile?: RiskProfile;
};

export type SavedPlan = {
  id: string;
  name: string;
  zip: string;
  zone: string;
  crops: string[];
  riskProfile: RiskProfile;
  climateDataVersion: string | null;
  climateDataStale: boolean;
  createdAt: string;
  updatedAt: string;
  schedule: ReturnType<typeof serializeSchedule>;
};

const climateRepository = getFileClimateRepository();

export async function scheduleForPlan(
  zip: string,
  zone: string,
  crops: string[],
  riskProfile: RiskProfile,
): Promise<Schedule> {
  return buildSchedule({
    zone,
    zip,
    crops,
    riskProfile,
    climateRepository,
  });
}

export function rowToPlan(
  row: Record<string, unknown>,
  schedule: Schedule,
): SavedPlan {
  const storedVersion = row.climate_data_version
    ? String(row.climate_data_version)
    : null;

  return {
    id: String(row.id),
    name: String(row.name),
    zip: String(row.zip),
    zone: String(row.zone),
    crops: JSON.parse(String(row.crops_json)) as string[],
    riskProfile: String(row.risk_profile) as RiskProfile,
    climateDataVersion: storedVersion,
    climateDataStale: isClimateVersionStale(storedVersion),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    schedule: serializeSchedule(schedule),
  };
}
