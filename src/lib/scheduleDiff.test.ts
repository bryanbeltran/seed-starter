import { describe, expect, it } from "vitest";
import type { Schedule } from "@/planning";
import { diffSchedules } from "./scheduleDiff";

function stub(lastFrost: string, label: string, date: string): Schedule {
  return {
    zone: "5a",
    zip: "55423",
    season: "spring",
    lastFrostDate: new Date(lastFrost),
    frostSource: "climate",
    frostProvenance: "test",
    riskProfile: "balanced",
    tasks: [
      {
        cropId: "tomato",
        type: "indoor_sow",
        date: new Date(date),
        label,
      },
    ],
  };
}

describe("diffSchedules", () => {
  it("counts added tasks", () => {
    const current = stub("2026-05-01", "Sow Tomato", "2026-03-01");
    const previous = { ...current, tasks: [] };
    expect(diffSchedules(previous, current)).toMatchObject({
      lastFrostChanged: false,
      tasksChanged: 1,
      changedLabels: ["Sow Tomato"],
    });
  });

  it("counts removed tasks", () => {
    const previous = stub("2026-05-01", "Sow Tomato", "2026-03-01");
    const current = { ...previous, tasks: [] };
    expect(diffSchedules(previous, current)).toMatchObject({
      tasksChanged: 1,
      changedLabels: ["Sow Tomato"],
    });
  });

  it("does not count unchanged tasks", () => {
    const schedule = stub("2026-05-01", "Sow Tomato", "2026-03-01");
    expect(diffSchedules(schedule, schedule)).toMatchObject({
      tasksChanged: 0,
      changedLabels: [],
    });
  });

  it("counts all changes while limiting the label preview to 12", () => {
    const previous = stub("2026-05-01", "Sow Tomato", "2026-03-01");
    previous.tasks = Array.from({ length: 14 }, (_, i) => ({
      ...previous.tasks[0],
      label: `Task ${i}`,
    }));
    const current = { ...previous, tasks: [] };
    const diff = diffSchedules(previous, current);
    expect(diff.tasksChanged).toBe(14);
    expect(diff.changedLabels).toEqual(previous.tasks.slice(0, 12).map((task) => task.label));
  });

  it("detects frost and task date changes", () => {
    const prev = stub("2026-05-01T00:00:00.000Z", "Sow Tomato", "2026-03-01T00:00:00.000Z");
    const curr = stub("2026-05-10T00:00:00.000Z", "Sow Tomato", "2026-03-10T00:00:00.000Z");
    const d = diffSchedules(prev, curr);
    expect(d.lastFrostChanged).toBe(true);
    expect(d.tasksChanged).toBe(1);
    expect(d.changedLabels).toContain("Sow Tomato");
  });
});
