import { addDays, subDays } from "date-fns";
import { resolveCropRules } from "./cropCatalog";
import { resolveLastFrost } from "./frostResolver";
import { shiftFrostDate } from "./riskProfile";
import type { CropSelection, PlantingTask, RiskProfile, Schedule, ScheduleInput } from "./types";

const DEFAULT_RISK_PROFILE: RiskProfile = "balanced";

function cropLabel(cropId: string, varietyName?: string): string {
  const base = cropId.charAt(0).toUpperCase() + cropId.slice(1);
  return varietyName ? `${base} (${varietyName})` : base;
}

function tasksForCrop(
  crop: CropSelection,
  anchorFrost: Date,
): PlantingTask[] {
  const rules = resolveCropRules(crop.cropId, crop.varietyId);
  const label = cropLabel(rules.id, rules.varietyName);
  const tasks: PlantingTask[] = [];

  if (rules.method === "transplant") {
    const indoorSow = subDays(anchorFrost, rules.indoorSowOffsetDays ?? 30);
    tasks.push({
      cropId: crop.cropId,
      type: "indoor_sow",
      date: indoorSow,
      label: `Sow ${label} indoors`,
    });

    const hardenDays = rules.hardenOffDaysBeforeTransplant ?? 7;
    const transplant = addDays(anchorFrost, rules.transplantDaysAfterFrost ?? 0);
    tasks.push({
      cropId: crop.cropId,
      type: "harden_off",
      date: subDays(transplant, hardenDays),
      label: `Start hardening off ${label}`,
    });
    tasks.push({
      cropId: crop.cropId,
      type: "transplant",
      date: transplant,
      label: `Transplant ${label} outdoors`,
    });
    tasks.push({
      cropId: crop.cropId,
      type: "harvest",
      date: addDays(transplant, rules.daysToHarvest),
      label: `Harvest ${label}`,
    });
    return tasks;
  }

  const directSow = subDays(anchorFrost, rules.directSowDaysBeforeFrost ?? 0);
  tasks.push({
    cropId: crop.cropId,
    type: "direct_sow",
    date: directSow,
    label: `Direct sow ${label}`,
  });
  tasks.push({
    cropId: crop.cropId,
    type: "harvest",
    date: addDays(directSow, rules.daysToHarvest),
    label: `Harvest ${label}`,
  });
  return tasks;
}

export function buildSchedule(input: ScheduleInput): Schedule {
  const {
    zone,
    crops,
    cropSelections,
    zip,
    riskProfile = DEFAULT_RISK_PROFILE,
    referenceDate = new Date(),
  } = input;

  const selections: CropSelection[] =
    cropSelections ??
    crops.map((cropId) => ({ cropId }));

  const frostResolution = resolveLastFrost({ zone, zip, referenceDate });
  const lastFrostDate = shiftFrostDate(
    frostResolution.lastFrostDate,
    riskProfile,
  );

  const tasks = selections.flatMap((crop) => tasksForCrop(crop, lastFrostDate));

  return {
    zone,
    zip,
    lastFrostDate,
    frostSource: frostResolution.source,
    frostProvenance: frostResolution.provenance,
    riskProfile,
    tasks,
  };
}

export type LegacySowDate = { seed: string; date: Date };

export function sowDatesFromSchedule(schedule: Schedule): LegacySowDate[] {
  return schedule.tasks
    .filter((t) => t.type === "indoor_sow" || t.type === "direct_sow")
    .map((t) => ({ seed: t.cropId, date: t.date }));
}

export function compareSchedules(
  input: Omit<ScheduleInput, "riskProfile">,
): Record<RiskProfile, Schedule> {
  return {
    conservative: buildSchedule({ ...input, riskProfile: "conservative" }),
    balanced: buildSchedule({ ...input, riskProfile: "balanced" }),
    aggressive: buildSchedule({ ...input, riskProfile: "aggressive" }),
  };
}
