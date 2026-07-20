import { addDays, subDays } from "date-fns";
import { cropSupportsSeason, getCropOrDefault, resolveCropRules } from "./cropCatalog";
import { UnsupportedSeasonCropError } from "./errors";
import { resolveFrost } from "./frostResolver";
import { selectFrostDate } from "./riskProfile";
import type {
  CropSelection,
  GardenSeason,
  PlantingTask,
  RiskProfile,
  Schedule,
  ScheduleInput,
} from "./types";

const DEFAULT_RISK_PROFILE: RiskProfile = "balanced";
const DEFAULT_SEASON: GardenSeason = "spring";

function cropLabel(cropId: string, varietyName?: string): string {
  const base = cropId.charAt(0).toUpperCase() + cropId.slice(1);
  return varietyName ? `${base} (${varietyName})` : base;
}

function frostSeason(season: GardenSeason): GardenSeason {
  return season === "fall" ? "fall" : "spring";
}

function tasksForCrop(
  crop: CropSelection,
  anchorFrost: Date,
  season: GardenSeason,
): PlantingTask[] {
  const rules = resolveCropRules(crop.cropId, crop.varietyId, season);
  const label = cropLabel(rules.id, rules.varietyName);
  const tasks: PlantingTask[] = [];
  const isFall = season === "fall";
  const isSummer = season === "summer";

  if (rules.method === "transplant") {
    const hardenDays = rules.hardenOffDaysBeforeTransplant ?? 7;
    const transplant = addDays(anchorFrost, rules.transplantDaysAfterFrost ?? 0);
    const harden = subDays(transplant, hardenDays);
    let indoorSow = subDays(anchorFrost, rules.indoorSowOffsetDays ?? 30);
    if (harden.getTime() < indoorSow.getTime()) {
      indoorSow = subDays(harden, 1);
    }

    tasks.push({
      cropId: crop.cropId,
      type: "indoor_sow",
      date: indoorSow,
      label: `Sow ${label} indoors`,
    });
    tasks.push({
      cropId: crop.cropId,
      type: "harden_off",
      date: harden,
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
  const sowType = isFall ? "fall_sow" : "direct_sow";
  const sowLabel = isFall
    ? `Sow ${label} for fall harvest`
    : isSummer
      ? `Direct sow ${label} (summer)`
      : `Direct sow ${label}`;
  tasks.push({
    cropId: crop.cropId,
    type: sowType,
    date: directSow,
    label: sowLabel,
  });

  const successionDays = rules.successionIntervalDays;
  if (isSummer && successionDays != null && successionDays > 0) {
    const second = addDays(directSow, successionDays);
    tasks.push({
      cropId: crop.cropId,
      type: "succession_sow",
      date: second,
      label: `Succession sow ${label}`,
    });
    tasks.push({
      cropId: crop.cropId,
      type: "harvest",
      date: addDays(second, rules.daysToHarvest),
      label: `Harvest ${label} (succession)`,
    });
  } else {
    tasks.push({
      cropId: crop.cropId,
      type: "harvest",
      date: addDays(directSow, rules.daysToHarvest),
      label: `Harvest ${label}`,
    });
  }
  return tasks;
}

function assertCropsSupportSeason(
  selections: CropSelection[],
  season: GardenSeason,
) {
  if (season === "spring") return;
  const unsupported = selections
    .map((s) => s.cropId)
    .filter((id) => !cropSupportsSeason(getCropOrDefault(id), season));
  if (unsupported.length) {
    throw new UnsupportedSeasonCropError(unsupported, season);
  }
}

export function buildSchedule(input: ScheduleInput): Schedule {
  const {
    zone,
    crops,
    cropSelections,
    zip,
    riskProfile = DEFAULT_RISK_PROFILE,
    season = DEFAULT_SEASON,
    referenceDate = new Date(),
    climateRepository,
  } = input;

  const selections: CropSelection[] =
    cropSelections ??
    crops.map((cropId) => ({ cropId }));

  assertCropsSupportSeason(selections, season);

  const frostResolution = resolveFrost(
    { zone, zip, referenceDate, season: frostSeason(season) },
    climateRepository,
  );
  const anchorFrost = selectFrostDate(
    frostResolution,
    riskProfile,
    frostSeason(season),
  );

  const tasks = selections.flatMap((crop) =>
    tasksForCrop(crop, anchorFrost, season),
  );

  const frostPercentiles =
    frostResolution.lastFrostP10 && frostResolution.lastFrostP90
      ? {
          p10: frostResolution.lastFrostP10,
          p50: frostResolution.lastFrostDate,
          p90: frostResolution.lastFrostP90,
        }
      : undefined;

  return {
    zone,
    zip,
    season,
    lastFrostDate: anchorFrost,
    frostSource: frostResolution.source,
    frostProvenance: frostResolution.provenance,
    frostPercentiles,
    climateDataVersion: frostResolution.dataVersion,
    climateConfidence: frostResolution.confidence,
    stationDistanceKm: frostResolution.distanceKm,
    riskProfile,
    tasks,
  };
}

export type LegacySowDate = { seed: string; date: Date };

export function sowDatesFromSchedule(schedule: Schedule): LegacySowDate[] {
  return schedule.tasks
    .filter(
      (t) =>
        t.type === "indoor_sow" ||
        t.type === "direct_sow" ||
        t.type === "fall_sow" ||
        t.type === "succession_sow",
    )
    .map((t) => ({ seed: t.cropId, date: t.date }));
}

export function compareSchedules(
  input: Omit<ScheduleInput, "riskProfile">,
): Record<RiskProfile, Schedule> {
  const base = { ...input };
  return {
    conservative: buildSchedule({ ...base, riskProfile: "conservative" }),
    balanced: buildSchedule({ ...base, riskProfile: "balanced" }),
    aggressive: buildSchedule({ ...base, riskProfile: "aggressive" }),
  };
}
