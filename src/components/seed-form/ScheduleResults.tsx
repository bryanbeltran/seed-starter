import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExportActions } from "./ExportActions";
import type { ScheduleResult } from "./types";

type Props = {
  results: ScheduleResult;
  zip: string;
};

export function ScheduleResults({ results, zip }: Props) {
  return (
    <Card className="print:shadow-none print:border-none">
      <CardHeader>
        <CardTitle className="print:text-xl">
          Zone {results.zone.toUpperCase()}
        </CardTitle>
        <CardDescription className="print:text-foreground">
          Last frost: {format(parseISO(results.lastFrostDate), "MMM d, yyyy")} (
          {results.frostSource} model)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="pb-2 pr-4">Task</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {results.tasks.map((task, i) => (
                <tr key={`${task.cropId}-${task.type}-${i}`} className="border-t">
                  <td className="py-2 pr-4">{task.label}</td>
                  <td className="py-2 text-muted-foreground print:text-foreground">
                    {format(parseISO(task.date), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ExportActions results={results} zip={zip} />
      </CardContent>
    </Card>
  );
}
