"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import type { RiskProfile } from "@/planning";
import { listCrops } from "@/planning/cropCatalog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CropPicker } from "./CropPicker";
import { LocationForm } from "./LocationForm";
import { RiskProfilePicker } from "./RiskProfilePicker";
import { ScheduleResults } from "./ScheduleResults";
import { ScheduleResultsSkeleton } from "./ScheduleResultsSkeleton";
import { ResultsPlaceholder } from "./ResultsPlaceholder";
import { CompareProfiles, type CompareResult } from "./CompareProfiles";
import { SavedPlansPanel, type SavedPlanSummary } from "./SavedPlansPanel";
import type { ScheduleResult } from "./types";
import {
  cropSelectionsFromForm,
  isValidZip,
  loadFormState,
  saveFormState,
} from "./formState";

const availableCrops = listCrops();

export function SeedForm() {
  const [zip, setZip] = useState("");
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [varieties, setVarieties] = useState<Record<string, string | undefined>>({});
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced");
  const [compareMode, setCompareMode] = useState(false);
  const [results, setResults] = useState<ScheduleResult | null>(null);
  const [compared, setCompared] = useState<CompareResult | null>(null);
  const [planName, setPlanName] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = loadFormState();
    if (saved) {
      if (saved.zip) setZip(saved.zip);
      if (saved.selectedCrops) setSelectedCrops(saved.selectedCrops);
      if (saved.varieties) setVarieties(saved.varieties);
      if (saved.riskProfile) setRiskProfile(saved.riskProfile);
      if (saved.compareMode) setCompareMode(saved.compareMode);
    }
  }, []);

  useEffect(() => {
    saveFormState({
      zip,
      selectedCrops,
      varieties,
      riskProfile,
      compareMode,
    });
  }, [zip, selectedCrops, varieties, riskProfile, compareMode]);

  function toggleCrop(cropId: string) {
    setCropError(null);
    setSelectedCrops((prev) =>
      prev.includes(cropId)
        ? prev.filter((c) => c !== cropId)
        : [...prev, cropId],
    );
  }

  function buildPayload() {
    const cropSelections = cropSelectionsFromForm(selectedCrops, varieties);
    return {
      zip: zip.replace(/\D/g, ""),
      seeds: selectedCrops,
      cropSelections,
      riskProfile,
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setZipError(null);
    setCropError(null);

    if (!isValidZip(zip)) {
      setZipError("Enter a valid 5-digit US ZIP code.");
      return;
    }
    if (selectedCrops.length === 0) {
      setCropError("Select at least one crop.");
      return;
    }

    setLoading(true);
    setResults(null);
    setCompared(null);
    setPlanName(undefined);

    try {
      const payload = buildPayload();
      const endpoint = compareMode ? "/api/schedules/compare" : "/api/schedules";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (compareMode) {
        setCompared(data as CompareResult);
        setResults(data.balanced as ScheduleResult);
      } else {
        setResults(data as ScheduleResult);
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleLoadPlan(plan: SavedPlanSummary) {
    setZip(plan.zip);
    setSelectedCrops(plan.crops);
    setVarieties({});
    setRiskProfile(plan.riskProfile);
    setResults(plan.schedule);
    setCompared(null);
    setPlanName(plan.name);
    setError(null);
    setStatus(`Loaded plan "${plan.name}".`);
  }

  const resultsPanel = loading ? (
    <ScheduleResultsSkeleton />
  ) : compared ? (
    <div className="space-y-4">
      <ScheduleResults results={results!} zip={zip} planName={planName} />
      <CompareProfiles compared={compared} baseline={riskProfile} />
    </div>
  ) : results ? (
    <ScheduleResults results={results} zip={zip} planName={planName} />
  ) : (
    <ResultsPlaceholder />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Your garden</CardTitle>
            <CardDescription>
              ZIP, crops, varieties, and frost-risk profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" id="plan-form">
              <LocationForm
                zip={zip}
                loading={loading}
                zipError={zipError}
                onZipChange={(v) => {
                  setZip(v);
                  setZipError(null);
                }}
                onTryExample={() => setZip("55423")}
              />
              <CropPicker
                crops={availableCrops}
                selected={selectedCrops}
                varieties={varieties}
                loading={loading}
                cropError={cropError}
                onToggle={toggleCrop}
                onVarietyChange={(cropId, varietyId) =>
                  setVarieties((prev) => ({ ...prev, [cropId]: varietyId }))
                }
              />
              <RiskProfilePicker
                value={riskProfile}
                loading={loading}
                onChange={setRiskProfile}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="compare-mode"
                  checked={compareMode}
                  onCheckedChange={(v) => setCompareMode(v === true)}
                  disabled={loading}
                />
                <Label htmlFor="compare-mode" className="cursor-pointer font-normal">
                  Compare risk profiles
                </Label>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div
                aria-live="polite"
                className="text-sm text-emerald-700 dark:text-emerald-400"
              >
                {status}
              </div>
              <Button type="submit" className="hidden w-full md:flex" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Building schedule…
                  </>
                ) : (
                  "Calculate schedule"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div>{resultsPanel}</div>
      </div>

      <SavedPlansPanel
        onLoadPlan={handleLoadPlan}
        onStatusMessage={setStatus}
        currentZip={zip}
        currentCrops={selectedCrops}
        currentRisk={riskProfile}
        hasResults={!!results}
      />

      <div className="bg-background fixed inset-x-0 bottom-0 border-t p-3 md:hidden print:hidden">
        <Button
          type="submit"
          form="plan-form"
          className="w-full"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" />
              Building…
            </>
          ) : (
            "Calculate schedule"
          )}
        </Button>
      </div>
    </div>
  );
}
