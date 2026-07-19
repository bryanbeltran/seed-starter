"use client";

import { format, parseISO } from "date-fns";
import { Bookmark } from "lucide-react";
import { getCrop } from "@/planning";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  varieties?: Record<string, string | undefined>;
  onSave?: () => void;
  canSave?: boolean;
};

function VarietyDtmNotes({
  cropIds,
  varieties,
}: {
  cropIds: string[];
  varieties?: Record<string, string | undefined>;
}) {
  if (!varieties) return null;
  const notes = cropIds.flatMap((cropId) => {
    const varietyId = varieties[cropId];
    if (!varietyId) return [];
    const crop = getCrop(cropId);
    const variety = crop?.varieties?.[varietyId];
    if (!variety?.daysToHarvest) return [];
    return [
      {
        cropId,
        name: variety.name,
        days: variety.daysToHarvest,
        sourceUrl: variety.sourceUrl,
      },
    ];
  });
  if (notes.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
      {notes.map((n) => (
        <li key={n.cropId}>
          {n.name}: {n.days} days to harvest
          {n.sourceUrl && (
            <>
              {" · "}
              <a
                href={n.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                source
              </a>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ScheduleResults({
  results,
  zip,
  planName,
  varieties,
  onSave,
  canSave,
}: Props) {
  const generatedAt = format(new Date(), "MMM d, yyyy h:mm a");
  const isFall = results.season === "fall";
  const frostLabel = isFall ? "First fall frost" : "Last spring frost";
  const confidenceLine =
    results.climateConfidence && results.stationDistanceKm != null
      ? `${results.climateConfidence} confidence · station ${results.stationDistanceKm} km away`
      : results.climateConfidence
        ? `${results.climateConfidence} confidence`
        : null;
  const cropIds = [...new Set(results.tasks.map((t) => t.cropId))];
  const seasonLabel = isFall ? "Fall" : "Spring";

  return (
    <Card className="print:shadow-none print:border-none">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="print:text-xl">
              Zone {results.zone.toUpperCase()}
            </CardTitle>
<<<<<<< HEAD
            <Badge variant="outline">{seasonLabel}</Badge>
=======
            <Badge variant="outline">
              {results.season === "fall" ? "Fall" : "Spring"}
            </Badge>
>>>>>>> 11c07c8 (feat(ui): season on share, print, plan list)
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="capitalize">
                    {results.frostSource} frost
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{results.frostProvenance}</p>
                  {results.climateDataVersion && (
                    <p className="text-muted-foreground mt-1">
                      Data {results.climateDataVersion}
                      {results.lastFrostP10 && results.lastFrostP90 && (
                        <>
                          {" "}
                          · p10{" "}
                          {format(parseISO(results.lastFrostP10), "MMM d")} – p90{" "}
                          {format(parseISO(results.lastFrostP90), "MMM d")}
                        </>
                      )}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
              {results.climateConfidence && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="capitalize">
                      {results.climateConfidence} confidence
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Station distance{" "}
                      {results.stationDistanceKm != null
                        ? `${results.stationDistanceKm} km`
                        : "unknown"}
                      . High ≤25 km, medium ≤60 km, low ≤200 km.
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
          {onSave && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="print:hidden"
              disabled={!canSave}
              onClick={onSave}
            >
              <Bookmark className="size-4" />
              Save plan
            </Button>
          )}
        </div>
        <CardDescription className="print:text-foreground">
          {planName && <span className="block font-medium">{planName}</span>}
          {frostLabel}: {format(parseISO(results.lastFrostDate), "MMM d, yyyy")} ·{" "}
          <span className="capitalize">{results.riskProfile}</span> profile
          {confidenceLine && (
            <span className="mt-1 block text-xs">{confidenceLine}</span>
          )}
          <VarietyDtmNotes cropIds={cropIds} varieties={varieties} />
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
