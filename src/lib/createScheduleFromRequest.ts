import {
  buildSchedule,
  compareSchedules,
  type RiskProfile,
  type Schedule,
} from "@/planning";
import type { ScheduleRequest } from "@/planning/api/scheduleRequestSchema";
import { getFileClimateRepository } from "@/climate";
import { resolveLocation } from "@/lib/resolveLocation";

const climateRepository = getFileClimateRepository();

export async function createScheduleFromRequest(
  data: ScheduleRequest,
): Promise<Schedule> {
  const { zip, zone } = await resolveLocation(data.zip);
  const cropSelections =
    data.cropSelections ?? data.seeds.map((cropId) => ({ cropId }));

  return buildSchedule({
    zone,
    zip,
    crops: data.seeds,
    cropSelections,
    riskProfile: data.riskProfile,
    climateRepository,
  });
}

export async function compareSchedulesFromRequest(
  data: ScheduleRequest,
): Promise<Record<RiskProfile, Schedule>> {
  const { zip, zone } = await resolveLocation(data.zip);
  const cropSelections =
    data.cropSelections ?? data.seeds.map((cropId) => ({ cropId }));

  return compareSchedules({
    zone,
    zip,
    crops: data.seeds,
    cropSelections,
    climateRepository,
  });
}
