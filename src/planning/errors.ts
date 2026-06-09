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
