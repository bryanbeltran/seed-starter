import { describe, expect, it } from "vitest";
import {
  compareSchedulesFromRequest,
  createScheduleFromRequest,
} from "./createScheduleFromRequest";

describe("createScheduleFromRequest", () => {
  it("builds schedule from validated request", async () => {
    const schedule = await createScheduleFromRequest({
      zip: "55423",
      seeds: ["tomato"],
      riskProfile: "balanced",
    });
    expect(schedule.zone).toBe("5a");
    expect(schedule.tasks.length).toBeGreaterThan(0);
  });

  it("compares schedules across risk profiles", async () => {
    const compared = await compareSchedulesFromRequest({
      zip: "55423",
      seeds: ["tomato"],
    });
    expect(compared.conservative.lastFrostDate.getTime()).toBeGreaterThan(
      compared.aggressive.lastFrostDate.getTime(),
    );
  });
});
