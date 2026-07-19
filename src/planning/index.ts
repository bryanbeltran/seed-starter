/**
 * Public planning module boundary.
 * Location resolution (ZIP → zone) stays outside this module.
 */

export type {
  CropSelection,
  FrostClimateLookup,
  FrostClimateRecord,
  FrostPercentiles,
  GardenSeason,
  Location,
  PlantingTask,
  RiskProfile,
  Schedule,
  ScheduleInput,
  TaskType,
} from "./types";

export { PlanningError, UnknownCropError } from "./errors";
export type { CropDefinition, VarietyDefinition } from "./cropCatalog";
export {
  cropIds,
  getCrop,
  getCropName,
  getCropOrDefault,
  listCrops,
  resolveCropRules,
  varietyCount,
} from "./cropCatalog";
export type { FrostModelSource, FrostResolution } from "./frostResolver";
export {
  resolveFrost,
  resolveFirstFallFrost,
  resolveLastFrost,
} from "./frostResolver";
export {
  fallFrostDateStringForZone,
  firstFallFrostDateForZone,
  frostDateStringForZone,
  frostDateStringForZoneBySeason,
  lastFrostDateForZone,
  nextFrostDate,
} from "./frost";
export {
  riskProfiles,
  selectFrostDate,
  shiftFrostDate,
} from "./riskProfile";
export type { SchedulingRules } from "./seasonRules";
export {
  fallRulesFromCrop,
  rulesFromCrop,
  springRulesFromCrop,
} from "./seasonRules";
export type { LegacySowDate } from "./schedule";
export {
  buildSchedule,
  compareSchedules,
  sowDatesFromSchedule,
} from "./schedule";
