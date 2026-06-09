"use client";

import { format, parseISO } from "date-fns";
import type { RiskProfile } from "@/planning";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScheduleResult } from "./types";

export type CompareResult = Record<RiskProfile, ScheduleResult>;

type Props = {
  compared: CompareResult;
  baseline: RiskProfile;
};

function keyTasks(tasks: ScheduleResult["tasks"]) {
  return tasks.filter(
    (t) => t.type === "indoor_sow" || t.type === "transplant" || t.type === "direct_sow",
  );
}

export function CompareProfiles({ compared, baseline }: Props) {
  const profiles: RiskProfile[] = ["conservative", "balanced", "aggressive"];

  return (
    <Tabs defaultValue={baseline} className="print:hidden">
      <TabsList className="grid w-full grid-cols-3">
        {profiles.map((p) => (
          <TabsTrigger key={p} value={p} className="capitalize">
            {p}
          </TabsTrigger>
        ))}
      </TabsList>
      {profiles.map((profile) => {
        const schedule = compared[profile];
        const tasks = keyTasks(schedule.tasks);
        const baseTasks = keyTasks(compared[baseline].tasks);

        return (
          <TabsContent key={profile} value={profile}>
            <p className="text-muted-foreground mb-3 text-sm">
              Last frost: {format(parseISO(schedule.lastFrostDate), "MMM d, yyyy")}
            </p>
            <ul className="space-y-2 text-sm">
              {tasks.map((task, i) => {
                const baseDate = baseTasks[i]?.date;
                const delta =
                  baseDate && profile !== baseline
                    ? Math.round(
                        (parseISO(task.date).getTime() - parseISO(baseDate).getTime()) /
                          86_400_000,
                      )
                    : 0;
                return (
                  <li key={`${task.type}-${i}`} className="flex justify-between gap-4">
                    <span>{task.label}</span>
                    <span className="text-muted-foreground shrink-0">
                      {format(parseISO(task.date), "MMM d")}
                      {delta !== 0 && (
                        <span
                          className={
                            delta > 0 ? "text-amber-600" : "text-emerald-600"
                          }
                        >
                          {" "}
                          ({delta > 0 ? "+" : ""}
                          {delta}d)
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
