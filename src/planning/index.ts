/**
 * Public planning module boundary.
 *
 * All schedule generation goes through buildSchedule().
 * Location resolution (ZIP → zone) stays outside this module.
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

export type { CropDefinition } from "./cropCatalog";
export { cropIds, getCrop, getCropOrDefault, listCrops } from "./cropCatalog";

export type { LegacySowDate } from "./schedule";
export { buildSchedule, sowDatesFromSchedule } from "./schedule";
