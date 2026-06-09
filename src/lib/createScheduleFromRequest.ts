import {
  buildSchedule,
  compareSchedules,
  type RiskProfile,
  type Schedule,
} from "@/planning";
import type { ScheduleRequest } from "@/planning/api/scheduleRequestSchema";
import { resolveLocation } from "@/lib/resolveLocation";

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
  });
}
