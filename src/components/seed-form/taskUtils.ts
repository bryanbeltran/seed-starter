import { differenceInCalendarDays, parseISO } from "date-fns";
import type { ScheduleTask } from "./types";

export function groupTasksByCrop(tasks: ScheduleTask[]) {
  const sorted = [...tasks].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
  );
  const groups = new Map<string, ScheduleTask[]>();
  for (const task of sorted) {
    const list = groups.get(task.cropId) ?? [];
    list.push(task);
    groups.set(task.cropId, list);
  }
  return groups;
}

export function daysFromToday(dateIso: string, now = new Date()) {
  return differenceInCalendarDays(parseISO(dateIso), now);
}

export function isPastTask(dateIso: string, now = new Date()) {
  return daysFromToday(dateIso, now) < 0;
}
