export class PlanningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningError";
  }
}

export class UnknownCropError extends PlanningError {
  readonly cropId: string;

  constructor(cropId: string) {
    super(`Unknown crop: ${cropId}`);
    this.name = "UnknownCropError";
    this.cropId = cropId;
  }
}

export class UnsupportedSeasonCropError extends PlanningError {
  readonly cropIds: string[];
  readonly season: string;

  constructor(cropIds: string[], season: string) {
    super(`Crops not available for ${season}: ${cropIds.join(", ")}`);
    this.name = "UnsupportedSeasonCropError";
    this.cropIds = cropIds;
    this.season = season;
  }
}
