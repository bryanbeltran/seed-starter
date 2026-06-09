/**
 * Public planning module boundary.
 * Framework-free domain logic lives under src/planning/.
 */

export type {
  CropSelection,
  Location,
  PlantingTask,
  RiskProfile,
  Schedule,
  ScheduleInput,
  TaskType,
} from "./types";

export { PlanningError, UnknownCropError } from "./errors";
export {
  frostDateStringForZone,
  lastFrostDateForZone,
  nextFrostDate,
} from "./frost";
export type { CropDefinition } from "./cropCatalog";
export {
  cropIds,
  getCrop,
  getCropOrDefault,
  listCrops,
} from "./cropCatalog";
export { buildSchedule } from "./schedule";
