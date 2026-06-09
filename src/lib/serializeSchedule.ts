import type { Schedule } from "@/planning";

export function serializeSchedule(schedule: Schedule) {
  return {
    zone: schedule.zone,
    zip: schedule.zip,
    lastFrostDate: schedule.lastFrostDate.toISOString(),
    frostSource: schedule.frostSource,
    frostProvenance: schedule.frostProvenance,
    lastFrostP10: schedule.frostPercentiles?.p10.toISOString(),
    lastFrostP50: schedule.frostPercentiles?.p50.toISOString(),
    lastFrostP90: schedule.frostPercentiles?.p90.toISOString(),
    climateDataVersion: schedule.climateDataVersion,
    riskProfile: schedule.riskProfile,
    tasks: schedule.tasks.map((t) => ({
      cropId: t.cropId,
      type: t.type,
      date: t.date.toISOString(),
      label: t.label,
    })),
    sowDates: schedule.tasks
      .filter((t) => t.type === "indoor_sow" || t.type === "direct_sow")
      .map((t) => ({ seed: t.cropId, date: t.date.toISOString() })),
  };
}
