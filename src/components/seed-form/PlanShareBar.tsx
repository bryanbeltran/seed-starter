"use client";

import { useEffect, useState } from "react";
import type { GardenSeason } from "@/planning";
import { ShareLinkButton } from "./ShareLinkButton";
import { seasonDisplayLabel } from "./seasonLabel";

type Props = {
  planId: string;
  planName: string;
  season?: GardenSeason;
};

export function PlanShareBar({ planId, planName, season }: Props) {
  const [url, setUrl] = useState(`/plans?id=${planId}`);
  const seasonLabel = seasonDisplayLabel(season);

  useEffect(() => {
    setUrl(`${window.location.origin}/plans?id=${planId}`);
  }, [planId]);

  return (
    <div className="mb-4 rounded-lg border bg-muted/40 px-4 py-3 print:hidden">
      <p className="text-sm font-medium">
        Shared plan: {planName} · {seasonLabel}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        Anyone with this link can view the schedule. Editing still requires your
        browser cookie on the main planner.
      </p>
      <div className="mt-2">
        <ShareLinkButton url={url} />
      </div>
    </div>
  );
}
