"use client";

import { CSVLink } from "react-csv";
import { useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const availableSeeds = [
  "tomato",
  "pepper",
  "lettuce",
  "carrot",
  "broccoli",
] as const;

type SowResult = {
  zone: string;
  sowDates: { seed: string; date: Date }[];
};

const csvHeaders = [
  { label: "Seed", key: "seed" },
  { label: "Sow Date", key: "date" },
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildICS(items: { seed: string; date: Date }[]) {
  const events = items.map(({ seed, date }) => {
    const yyyy = date.getFullYear().toString().padStart(4, "0");
    const mm = (date.getMonth() + 1).toString().padStart(2, "0");
    const dd = date.getDate().toString().padStart(2, "0");
    const dt = `${yyyy}${mm}${dd}`;
    return [
      "BEGIN:VEVENT",
      `UID:${seed}-${dt}@seedstarter`,
      `DTSTAMP:${dt}T120000Z`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:Sow ${capitalize(seed)}`,
      "END:VEVENT",
    ].join("\n");
  });

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SeedStarter//EN", ...events, "END:VCALENDAR"].join("\n");
}

export function SeedForm() {
  const [zip, setZip] = useState("");
  const [selectedSeeds, setSelectedSeeds] = useState<string[]>([]);
  const [results, setResults] = useState<SowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const csvData =
    results?.sowDates.map(({ seed, date }) => ({
      seed,
      date: format(date, "yyyy-MM-dd"),
    })) ?? [];

  function toggleSeed(seed: string) {
    setSelectedSeeds((prev) =>
      prev.includes(seed) ? prev.filter((s) => s !== seed) : [...prev, seed],
    );
  }

  function downloadICS() {
    if (!results) return;
    const blob = new Blob([buildICS(results.sowDates)], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sow-dates-${zip}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!zip.trim()) {
      setError("Enter a ZIP code.");
      return;
    }
    if (selectedSeeds.length === 0) {
      setError("Select at least one crop.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip, seeds: selectedSeeds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResults(null);
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setResults({
        zone: data.zone,
        sowDates: data.sowDates.map(
          (row: { seed: string; date: string }) => ({
            seed: row.seed,
            date: parseISO(row.date),
          }),
        ),
      });
    } catch {
      setResults(null);
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Your garden</CardTitle>
          <CardDescription>
            Enter a US ZIP code and pick crops to plan indoor sow dates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="zip">ZIP code</Label>
              <Input
                id="zip"
                inputMode="numeric"
                autoComplete="postal-code"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="e.g. 55423"
                className="mt-1"
                disabled={loading}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Crops</legend>
              {availableSeeds.map((seed) => (
                <label
                  key={seed}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedSeeds.includes(seed)}
                    onChange={() => toggleSeed(seed)}
                    disabled={loading}
                    className="size-4 rounded border-input"
                  />
                  {capitalize(seed)}
                </label>
              ))}
            </fieldset>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Calculating…" : "Calculate sow dates"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Zone {results.zone.toUpperCase()}</CardTitle>
            <CardDescription>
              Indoor sow dates based on your last frost date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-1 text-sm">
              {results.sowDates.map(({ seed, date }) => (
                <li key={seed} className="flex justify-between gap-4">
                  <span>{capitalize(seed)}</span>
                  <span className="text-muted-foreground">
                    {format(date, "MMM d, yyyy")}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 sm:flex-row">
              <CSVLink
                data={csvData}
                headers={csvHeaders}
                filename={`sow-dates-${zip}.csv`}
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
