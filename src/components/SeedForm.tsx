"use client";

import { useState, type FormEvent } from "react";
import type { RiskProfile } from "@/planning";
import { listCrops } from "@/planning/cropCatalog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CropPicker } from "./seed-form/CropPicker";
import { LocationForm } from "./seed-form/LocationForm";
import { RiskProfilePicker } from "./seed-form/RiskProfilePicker";
import { ScheduleResults } from "./seed-form/ScheduleResults";
import type { ScheduleResult } from "./seed-form/types";

const availableCrops = listCrops();

export function SeedForm() {
  const [zip, setZip] = useState("");
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced");
  const [results, setResults] = useState<ScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleCrop(cropId: string) {
    setSelectedCrops((prev) =>
      prev.includes(cropId)
        ? prev.filter((c) => c !== cropId)
        : [...prev, cropId],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!zip.trim()) {
      setError("Enter a ZIP code.");
      return;
    }
    if (selectedCrops.length === 0) {
      setError("Select at least one crop.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zip,
          seeds: selectedCrops,
          riskProfile,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResults(null);
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setResults(data as ScheduleResult);
    } catch {
      setResults(null);
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 print:block print:max-w-none">
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Your garden</CardTitle>
          <CardDescription>
            Enter a US ZIP code, pick crops, and choose a frost-risk profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <LocationForm zip={zip} loading={loading} onZipChange={setZip} />
            <CropPicker
              crops={availableCrops}
              selected={selectedCrops}
              loading={loading}
              onToggle={toggleCrop}
            />
            <RiskProfilePicker
              value={riskProfile}
              loading={loading}
              onChange={setRiskProfile}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Calculating…" : "Calculate schedule"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {results && <ScheduleResults results={results} zip={zip} />}
    </div>
  );
}
