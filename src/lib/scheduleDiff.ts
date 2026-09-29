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
  const prevByLabel = new Map(prev.tasks.map((t) => [t.label, t.date]));
  const currentLabels = new Set(curr.tasks.map((t) => t.label));
  const changedLabels: string[] = [];
  for (const t of curr.tasks) {
    const old = prevByLabel.get(t.label);
    if (old !== t.date) changedLabels.push(t.label);
  }
  for (const t of prev.tasks) {
    if (!currentLabels.has(t.label)) changedLabels.push(t.label);
  }
  return {
    lastFrostChanged: prev.lastFrostDate !== curr.lastFrostDate,
    previousLastFrost: prev.lastFrostDate,
    currentLastFrost: curr.lastFrostDate,
    tasksChanged: changedLabels.length,
    changedLabels: changedLabels.slice(0, 12),
  };
}
