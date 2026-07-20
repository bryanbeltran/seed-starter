"use client";

import { CSVLink } from "react-csv";
import { Button } from "@/components/ui/button";
import { buildICS } from "./buildICS";
import type { ScheduleResult } from "./types";

type Props = {
  results: ScheduleResult;
  zip: string;
};

export function ExportActions({ results, zip }: Props) {
  const csvData = results.tasks.map((t) => ({
    crop: t.cropId,
    task: t.type,
    label: t.label,
    date: t.date.split("T")[0],
  }));

  const season = results.season ?? "spring";
  const seasonSlug = season === "fall" ? "fall" : "spring";

  function downloadICS() {
    const blob = new Blob([buildICS(results.tasks, zip, season)], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `garden-schedule-${zip}-${seasonSlug}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printSchedule() {
    window.print();
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row print:hidden">
      <CSVLink
        data={csvData}
        headers={[
          { label: "Crop", key: "crop" },
          { label: "Task", key: "task" },
          { label: "Label", key: "label" },
          { label: "Date", key: "date" },
        ]}
        filename={`garden-schedule-${zip}-${seasonSlug}.csv`}
      >
        <Button variant="outline" className="w-full sm:w-auto">
          Download CSV
        </Button>
      </CSVLink>
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        onClick={downloadICS}
      >
        Download calendar (.ics)
      </Button>
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        onClick={printSchedule}
      >
        Print schedule
      </Button>
    </div>
  );
}
