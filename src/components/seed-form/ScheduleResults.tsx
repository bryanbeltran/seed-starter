"use client";

import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExportActions } from "./ExportActions";
import { TaskTimeline } from "./TaskTimeline";
import type { ScheduleResult } from "./types";

type Props = {
  results: ScheduleResult;
  zip: string;
  planName?: string;
};

export function ScheduleResults({ results, zip, planName }: Props) {
  const generatedAt = format(new Date(), "MMM d, yyyy h:mm a");

  return (
    <Card className="print:shadow-none print:border-none">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="print:text-xl">
            Zone {results.zone.toUpperCase()}
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="capitalize">
                  {results.frostSource} frost
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{results.frostProvenance}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="print:text-foreground">
          {planName && <span className="block font-medium">{planName}</span>}
          Last frost: {format(parseISO(results.lastFrostDate), "MMM d, yyyy")} ·{" "}
          <span className="capitalize">{results.riskProfile}</span> profile
          <span className="print:block text-xs">Generated {generatedAt}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TaskTimeline tasks={results.tasks} />
        <ExportActions results={results} zip={zip} />
      </CardContent>
    </Card>
  );
}
