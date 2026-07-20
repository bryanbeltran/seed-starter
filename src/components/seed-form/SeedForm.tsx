"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import type { GardenSeason, RiskProfile } from "@/planning";
import { cropIdsForSeason, listCrops } from "@/planning/cropCatalog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { SeasonPicker } from "./SeasonPicker";
import { ScheduleResults } from "./ScheduleResults";
import { ScheduleResultsSkeleton } from "./ScheduleResultsSkeleton";
import { ResultsPlaceholder } from "./ResultsPlaceholder";
import { CompareProfiles, type CompareResult } from "./CompareProfiles";
import { SavedPlansPanel, type SavedPlanSummary } from "./SavedPlansPanel";
import { PlannerHero } from "./PlannerHero";
import { StatusBanner } from "./StatusBanner";
import type { ScheduleResult } from "./types";
import {
  parseIsoDateLocal,
  suggestSeasonFromFrost,
} from "./defaultSeason";
import {
  cropSelectionsFromForm,
  defaultSeasonForDate,
  isValidZip,
  loadFormState,
  saveFormState,
} from "./formState";
import type { LocationPreview } from "./LocationForm";
import { cn } from "@/lib/utils";

const availableCrops = listCrops();

export function SeedForm() {
  const [zip, setZip] = useState("");
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [varieties, setVarieties] = useState<Record<string, string | undefined>>({});
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced");
  const [season, setSeason] = useState<GardenSeason>(() => defaultSeasonForDate());
  const [seasonLocked, setSeasonLocked] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [results, setResults] = useState<ScheduleResult | null>(null);
  const [compared, setCompared] = useState<CompareResult | null>(null);
  const [planName, setPlanName] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<"success" | "error">("success");
  const [zipError, setZipError] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState("plan");
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadFormState();
    if (saved) {
      if (saved.zip) setZip(saved.zip);
      if (saved.selectedCrops) setSelectedCrops(saved.selectedCrops);
      if (saved.varieties) setVarieties(saved.varieties);
      if (saved.riskProfile) setRiskProfile(saved.riskProfile);
      if (saved.season) {
        setSeason(saved.season);
        setSeasonLocked(true);
      }
      if (saved.compareMode) setCompareMode(saved.compareMode);
    }
  }, []);

  useEffect(() => {
    saveFormState({
      zip,
      selectedCrops,
      varieties,
      riskProfile,
      season,
      compareMode,
    });
  }, [zip, selectedCrops, varieties, riskProfile, season, compareMode]);

  function setStatusMessage(msg: string, variant: "success" | "error" = "success") {
    setStatus(msg);
    setStatusVariant(variant);
  }

  function toggleCrop(cropId: string) {
    setCropError(null);
    setSelectedCrops((prev) =>
      prev.includes(cropId)
        ? prev.filter((c) => c !== cropId)
        : [...prev, cropId],
    );
  }

  function buildPayload(
    zipValue: string,
    crops: string[],
    varietyMap: Record<string, string | undefined>,
    risk: RiskProfile,
    seasonValue: GardenSeason,
  ) {
    const cropSelections = cropSelectionsFromForm(crops, varietyMap);
    return {
      zip: zipValue.replace(/\D/g, ""),
      seeds: crops,
      cropSelections,
      riskProfile: risk,
      season: seasonValue,
    };
  }

  function applySeason(next: GardenSeason) {
    setSeason(next);
    const allowed = new Set(cropIdsForSeason(next));
    setSelectedCrops((prev) => prev.filter((id) => allowed.has(id)));
    setVarieties((prev) => {
      const filtered: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (allowed.has(k)) filtered[k] = v;
      }
      return filtered;
    });
  }

  function handleSeasonChange(next: GardenSeason) {
    setSeasonLocked(true);
    applySeason(next);
  }

  function handleLocationPreview(preview: LocationPreview) {
    if (seasonLocked || !preview.lastSpringFrostP50) return;
    const suggested = suggestSeasonFromFrost({
      lastSpringFrostP50: parseIsoDateLocal(preview.lastSpringFrostP50),
      firstFallFrostP50: preview.firstFallFrostP50
        ? parseIsoDateLocal(preview.firstFallFrostP50)
        : null,
    });
    if (suggested !== season) applySeason(suggested);
  }

  async function runCalculate(
    zipValue: string,
    crops: string[],
    varietyMap: Record<string, string | undefined>,
    risk: RiskProfile,
    compare: boolean,
    seasonValue: GardenSeason,
  ) {
    setError(null);
    setStatus(null);
    setZipError(null);
    setCropError(null);

    if (!isValidZip(zipValue)) {
      setZipError("Enter a valid 5-digit US ZIP code.");
      return;
    }
    if (crops.length === 0) {
      setCropError("Select at least one crop.");
      return;
    }

    setLoading(true);
    setResults(null);
    setCompared(null);
    setPlanName(undefined);

    try {
      const payload = buildPayload(zipValue, crops, varietyMap, risk, seasonValue);
      const endpoint = compare ? "/api/schedules/compare" : "/api/schedules";
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
      if (compare) {
        setCompared(data as CompareResult);
        setResults(data.balanced as ScheduleResult);
      } else {
        setResults(data as ScheduleResult);
      }
      setMobileTab("results");
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await runCalculate(zip, selectedCrops, varieties, riskProfile, compareMode, season);
  }

  async function loadExample() {
    const exampleZip = "55423";
    const exampleCrops = ["tomato"];
    setZip(exampleZip);
    setSelectedCrops(exampleCrops);
    setVarieties({});
    setRiskProfile("balanced");
    setSeason("spring");
    setCompareMode(false);
    await runCalculate(exampleZip, exampleCrops, {}, "balanced", false, "spring");
  }

  function handleLoadPlan(plan: SavedPlanSummary) {
    setZip(plan.zip);
    setSelectedCrops(plan.crops);
    setVarieties(plan.varieties ?? {});
    setRiskProfile(plan.riskProfile);
    if (plan.season) {
      setSeason(plan.season);
      setSeasonLocked(true);
    }
    setResults(plan.schedule);
    setCompared(null);
    setPlanName(plan.name);
    setError(null);
    setStatusMessage(`Loaded plan "${plan.name}".`);
    setMobileTab("results");
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const canSave = Boolean(results) && selectedCrops.length > 0 && isValidZip(zip);

  const resultsPanel = loading ? (
    <ScheduleResultsSkeleton />
  ) : compared ? (
    <div className="space-y-4">
      <ScheduleResults
        results={results!}
        zip={zip}
        planName={planName}
        varieties={varieties}
        onSave={() => setSaveOpen(true)}
        canSave={canSave}
      />
      <CompareProfiles compared={compared} baseline={riskProfile} />
    </div>
  ) : results ? (
    <ScheduleResults
      results={results}
      zip={zip}
      planName={planName}
      varieties={varieties}
      onSave={() => setSaveOpen(true)}
      canSave={canSave}
    />
  ) : (
    <ResultsPlaceholder />
  );

  const planForm = (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle>Your garden</CardTitle>
        <CardDescription>
          ZIP, season, crops, varieties, and frost-risk profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" id="plan-form">
          <LocationForm
            zip={zip}
            loading={loading}
            zipError={zipError}
            season={season}
            onZipChange={(v) => {
              setZip(v);
              setZipError(null);
              setSeasonLocked(false);
            }}
            onTryExample={() => {
              setSeasonLocked(false);
              setZip("55423");
            }}
            onPreview={handleLocationPreview}
          />
          <SeasonPicker
            value={season}
            loading={loading}
            onChange={handleSeasonChange}
          />
          <CropPicker
            crops={availableCrops}
            selected={selectedCrops}
            varieties={varieties}
            loading={loading}
            cropError={cropError}
            season={season}
            onToggle={toggleCrop}
            onVarietyChange={(cropId, varietyId) =>
              setVarieties((prev) => ({ ...prev, [cropId]: varietyId }))
            }
          />
          <RiskProfilePicker
            value={riskProfile}
            loading={loading}
            onChange={setRiskProfile}
            season={season}
          />
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="compare-mode"
                checked={compareMode}
                onCheckedChange={(v) => setCompareMode(v === true)}
                disabled={loading}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="compare-mode" className="cursor-pointer font-medium">
                  Compare risk profiles
                </Label>
                <p className="text-muted-foreground text-xs">
                  See conservative, balanced, and aggressive dates side by side.
                </p>
              </div>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <StatusBanner message={status} variant={statusVariant} />
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
  );

  const savedPanel = (
    <SavedPlansPanel
      onLoadPlan={handleLoadPlan}
      onStatusMessage={setStatusMessage}
      currentZip={zip}
      currentCrops={selectedCrops}
      currentVarieties={varieties}
      currentRisk={riskProfile}
      currentSeason={season}
      saveOpen={saveOpen}
      onSaveOpenChange={setSaveOpen}
    />
  );

  const desktopLayout = (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="grid min-w-0 gap-6">
        <div className={cn(mobileTab !== "plan" && "hidden", "min-w-0 lg:block")}>
          {planForm}
        </div>
        <div
          ref={resultsRef}
          tabIndex={-1}
          className={cn(mobileTab !== "results" && "hidden", "min-w-0 lg:block")}
        >
          {resultsPanel}
        </div>
      </div>
      <div className={cn(mobileTab !== "saved" && "hidden", "min-w-0 lg:block")}>
        {savedPanel}
      </div>
    </div>
  );

  return (
    <>
      <PlannerHero onExample={() => void loadExample()} loading={loading} />
      <Tabs value={mobileTab} onValueChange={setMobileTab} className="mb-4 lg:hidden">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
        </TabsList>
      </Tabs>
      {desktopLayout}
      <div className="bg-background fixed inset-x-0 bottom-0 z-40 border-t p-3 lg:hidden print:hidden">
        {status && (
          <div className="mb-2">
            <StatusBanner message={status} variant={statusVariant} />
          </div>
        )}
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
    </>
  );
}
