import type { Schedule } from "@/planning";

export function serializeSchedule(schedule: Schedule) {
  return {
    zone: schedule.zone,
    zip: schedule.zip,
    lastFrostDate: schedule.lastFrostDate.toISOString(),
    frostSource: schedule.frostSource,
    frostProvenance: schedule.frostProvenance,
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
