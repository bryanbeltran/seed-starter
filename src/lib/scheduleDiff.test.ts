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

  it("does not count reordered tasks with repeated labels as changes", () => {
    const previous = stub("2026-05-01", "Sow Tomato", "2026-03-01");
    previous.tasks.push({ ...previous.tasks[0], date: new Date("2026-03-15") });
    const current = { ...previous, tasks: [...previous.tasks].reverse() };
    expect(diffSchedules(previous, current).tasksChanged).toBe(0);
  });

  it("counts a removed occurrence of a repeated task", () => {
    const previous = stub("2026-05-01", "Sow Tomato", "2026-03-01");
    previous.tasks.push({ ...previous.tasks[0] });
    const current = { ...previous, tasks: previous.tasks.slice(0, 1) };
    expect(diffSchedules(previous, current)).toMatchObject({
      tasksChanged: 1,
      changedLabels: ["Sow Tomato"],
    });
    expect(diffSchedules(current, previous).tasksChanged).toBe(1);
  });

  it("counts only the rescheduled occurrence of a repeated label", () => {
    const previous = stub("2026-05-01", "Sow Tomato", "2026-03-01");
    previous.tasks.push({ ...previous.tasks[0], date: new Date("2026-03-15") });
    const current = {
      ...previous,
      tasks: [previous.tasks[1], { ...previous.tasks[0], date: new Date("2026-03-02") }],
    };
    expect(diffSchedules(previous, current)).toMatchObject({
      tasksChanged: 1,
      changedLabels: ["Sow Tomato"],
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
