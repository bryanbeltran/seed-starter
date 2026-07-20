"use client";

import {
  Flower2,
  Home,
  Leaf,
  Shovel,
  Sprout,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { getCropName } from "@/planning";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ScheduleTask } from "./types";
import { daysFromToday, groupTasksByCrop, isPastTask } from "./taskUtils";

const taskIcons: Record<string, LucideIcon> = {
  indoor_sow: Home,
  harden_off: Sun,
  transplant: Shovel,
  direct_sow: Sprout,
  fall_sow: Leaf,
  succession_sow: Sprout,
  harvest: Flower2,
};

function TaskRow({ task }: { task: ScheduleTask }) {
  const Icon = taskIcons[task.type] ?? Sprout;
  const past = isPastTask(task.date);
  const days = daysFromToday(task.date);
  const relative =
    days === 0
      ? "Today"
      : days > 0
        ? `In ${days} day${days === 1 ? "" : "s"}`
        : `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-md px-2 py-2",
        past ? "text-muted-foreground opacity-70" : "bg-accent/30",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm">{task.label}</p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(task.date), "MMM d, yyyy")} · {relative}
        </p>
      </div>
    </li>
  );
}

type Props = {
  tasks: ScheduleTask[];
};

export function TaskTimeline({ tasks }: Props) {
  const groups = groupTasksByCrop(tasks);

  return (
    <Accordion type="multiple" defaultValue={[...groups.keys()]} className="w-full">
      {[...groups.entries()].map(([cropId, cropTasks]) => (
        <AccordionItem key={cropId} value={cropId}>
          <AccordionTrigger>{getCropName(cropId)}</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1">
              {cropTasks.map((task, i) => (
                <TaskRow key={`${task.type}-${i}`} task={task} />
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
