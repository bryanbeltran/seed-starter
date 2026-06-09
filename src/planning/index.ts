/**
 * Public planning module boundary.
 * Location resolution (ZIP → zone) stays outside this module.
 */

export type {
  CropSelection,
  FrostClimateLookup,
  FrostPercentiles,
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
  getCropOrDefault,
  listCrops,
  resolveCropRules,
  varietyCount,
} from "./cropCatalog";
export type { FrostModelSource, FrostResolution } from "./frostResolver";
export { resolveLastFrost } from "./frostResolver";
export {
  riskProfiles,
  selectFrostDate,
  shiftFrostDate,
} from "./riskProfile";
export type { LegacySowDate } from "./schedule";
export {
  buildSchedule,
  compareSchedules,
  sowDatesFromSchedule,
} from "./schedule";
