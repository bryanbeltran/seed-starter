"use client";

import { useEffect, useState } from "react";
import { ShareLinkButton } from "./ShareLinkButton";

type Props = {
  planId: string;
  planName: string;
};

export function PlanShareBar({ planId, planName }: Props) {
  const [url, setUrl] = useState(`/plans?id=${planId}`);

  useEffect(() => {
    setUrl(`${window.location.origin}/plans?id=${planId}`);
  }, [planId]);

  return (
    <div className="mb-4 rounded-lg border bg-muted/40 px-4 py-3 print:hidden">
      <p className="text-sm font-medium">Shared plan: {planName}</p>
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
