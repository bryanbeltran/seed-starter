import type { Schedule } from "@/planning";
import { serializeSchedule } from "./serializeSchedule";

export type ScheduleDiff = {
  lastFrostChanged: boolean;
  previousLastFrost: string;
  currentLastFrost: string;
  tasksChanged: number;
  changedLabels: string[];
};

export function diffSchedules(previous: Schedule, current: Schedule): ScheduleDiff {
  const prev = serializeSchedule(previous);
  const curr = serializeSchedule(current);
  // Preserve multiplicity: several selections can produce the same task label.
  const datesByLabel = new Map<string, Map<string, number>>();
  for (const [tasks, delta] of [[curr.tasks, 1], [prev.tasks, -1]] as const) {
    for (const task of tasks) {
      let dates = datesByLabel.get(task.label);
      if (!dates) {
        dates = new Map();
        datesByLabel.set(task.label, dates);
      }
      dates.set(task.date, (dates.get(task.date) ?? 0) + delta);
    }
  }
  const changedLabels: string[] = [];
  for (const [label, dates] of datesByLabel) {
    let added = 0;
    let removed = 0;
    for (const count of dates.values()) {
      if (count > 0) added += count;
      else removed -= count;
    }
    // Pair unmatched dates as rescheduled tasks, then count additions/removals.
    for (let i = 0; i < Math.max(added, removed); i++) changedLabels.push(label);
  }
  return {
    lastFrostChanged: prev.lastFrostDate !== curr.lastFrostDate,
    previousLastFrost: prev.lastFrostDate,
    currentLastFrost: curr.lastFrostDate,
    tasksChanged: changedLabels.length,
    changedLabels: changedLabels.slice(0, 12),
  };
}
