"use client";
// Silence missing type declarations for react-csv
// @ts-ignore
import { CSVLink } from "react-csv";
import React, { useState, FormEvent } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { calculateSowDates } from "@/lib/calculateSowDates";
import { format } from "date-fns";

const availableSeeds = [
  "tomato",
  "pepper",
  "lettuce",
  "carrot",
  "broccoli",
];

/**
 * Build an iCalendar (.ics) string for all-day sow events
 */
const buildICS = (items: { seed: string; date: Date }[]) => {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SeedStarter//EN',
  ];

  const events = items.map(({ seed, date }) => {
    const yyyy = date.getUTCFullYear().toString().padStart(4, '0');
    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = date.getUTCDate().toString().padStart(2, '0');
    const dt = `${yyyy}${mm}${dd}`;
    const uid = `${seed}-${dt}@seedstarter`;

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dt}T000000Z`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:Sow ${seed.charAt(0).toUpperCase() + seed.slice(1)}`,
      'END:VEVENT',
    ].join('\n');
  });

  return [...header, ...events, 'END:VCALENDAR'].join('\n');
};

export function SeedForm() {
  const [zip, setZip] = useState("");
  const [selectedSeeds, setSelectedSeeds] = useState<string[]>([]);
  const [results, setResults] = useState<{
    zone: string;
    sowDates: { seed: string; date: Date }[];
  } | null>(null);

  // CSV headers definition
  const csvHeaders = [
    { label: "Seed", key: "seed" },
    { label: "Sow Date", key: "date" },
  ];

  // Transform sowDates to CSV-friendly format
  const csvData =
    results?.sowDates.map(({ seed, date }) => ({
      seed,
      date: date.toISOString().split("T")[0],
    })) || [];

  // Download .ics calendar
  const downloadICS = () => {
    if (!results) return;
    const icsContent = buildICS(results.sowDates);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sow-dates-${zip}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  function handleSeedChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
    setSelectedSeeds(opts);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!zip || selectedSeeds.length === 0) return;
    const res = await calculateSowDates(zip, selectedSeeds);
    setResults(res);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        <div>
          <Label htmlFor="zip">ZIP Code</Label>
          <Input
            id="zip"
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="e.g. 55423"
            className="mt-1 w-full"
          />
        </div>

        <div>
          <Label htmlFor="seeds">Choose seeds</Label>
          <select
            id="seeds"
            multiple
            value={selectedSeeds}
            onChange={handleSeedChange}
            className="mt-1 block w-full rounded-md border-gray-300 bg-white p-2"
          >
            {availableSeeds.map((seed) => (
              <option key={seed} value={seed}>
                {seed.charAt(0).toUpperCase() + seed.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit">Start</Button>
      </form>

      {results && (
        <div className="p-4">
          <h2 className="text-lg font-medium">
            Your Zone: {results.zone.toUpperCase()}
          </h2>

          <ul className="list-disc pl-5 mt-2">
            {results.sowDates.map(({ seed, date }) => (
              <li key={seed}>
                {seed.charAt(0).toUpperCase() + seed.slice(1)}: {format(date, 'MM/dd/yyyy')}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <CSVLink
              data={csvData}
              headers={csvHeaders}
              filename={`sow-dates-${zip}.csv`}
              className="inline-block"
            >
              <Button>Download CSV</Button>
            </CSVLink>

            <Button onClick={downloadICS}>Download .ics</Button>
          </div>
        </div>
      )}
    </>
  );
}
