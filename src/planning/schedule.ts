import { subDays } from "date-fns";
import { getCropOrDefault } from "./cropCatalog";
import { lastFrostDateForZone } from "./frost";
import type { PlantingTask, RiskProfile, Schedule, ScheduleInput } from "./types";

const DEFAULT_RISK_PROFILE: RiskProfile = "balanced";

export function buildSchedule(input: ScheduleInput): Schedule {
  const {
    zone,
    crops,
    riskProfile = DEFAULT_RISK_PROFILE,
    referenceDate = new Date(),
  } = input;

  const lastFrostDate = lastFrostDateForZone(zone, referenceDate);

  const tasks: PlantingTask[] = crops.map((cropId) => {
    const crop = getCropOrDefault(cropId);
    return {
      cropId,
      type: "indoor_sow",
      date: subDays(lastFrostDate, crop.indoorSowOffsetDays),
      label: `Sow ${crop.name} indoors`,
    };
  });

  return {
    zone,
    lastFrostDate,
    riskProfile,
    tasks,
  };
}

export type LegacySowDate = { seed: string; date: Date };

/** Map schedule tasks to the legacy API/UI sow-date shape. */
export function sowDatesFromSchedule(schedule: Schedule): LegacySowDate[] {
  return schedule.tasks
    .filter((t) => t.type === "indoor_sow")
    .map((t) => ({ seed: t.cropId, date: t.date }));
}
