"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type NativeTask = { type: string; date: string; label: string };
type NativePlant = {
  id: string;
  commonName: string;
  scientificName: string;
  habit: string;
  needsStratification: boolean;
  sourceUrl: string;
  confidence: string;
  tasks: NativeTask[];
};

type NativesResponse = {
  zip: string;
  zone: string;
  season?: string;
  ecoregion: { id: string; name: string } | null;
  lastFrostDate: string;
  frostSource: string;
  catalogCoverage: string;
  plants: NativePlant[];
  error?: string;
};

function isValidZip(zip: string) {
  return /^\d{5}$/.test(zip.replace(/\D/g, ""));
}

export function NativesLookup() {
  const searchParams = useSearchParams();
  const [zip, setZip] = useState("");
  const [season, setSeason] = useState<"spring" | "fall">("spring");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NativesResponse | null>(null);

  async function load(zipValue: string, seasonValue: "spring" | "fall") {
    if (!isValidZip(zipValue)) {
      setError("Enter a valid 5-digit US ZIP code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        zip: zipValue.replace(/\D/g, ""),
        season: seasonValue,
      });
      const res = await fetch(`/api/natives?${q}`);
      const body = (await res.json()) as NativesResponse;
      if (!res.ok) {
        setData(null);
        setError(body.error ?? "Lookup failed.");
        return;
      }
      setData(body);
    } catch {
      setData(null);
      setError("Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const qZip = searchParams.get("zip");
    const qSeason = searchParams.get("season") === "fall" ? "fall" : "spring";
    setSeason(qSeason);
    if (qZip && isValidZip(qZip)) {
      setZip(qZip);
      void load(qZip, qSeason);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial deep-link only
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void load(zip, season);
  }

  const isFall = data?.season === "fall";
  const frostLabel = isFall ? "First fall frost" : "Last spring frost";

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="natives-zip">ZIP code</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="natives-zip"
              inputMode="numeric"
              autoComplete="postal-code"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="e.g. 55423"
              disabled={loading}
              aria-invalid={!!error}
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Looking up…" : "Find natives"}
            </Button>
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Sow season</legend>
          <RadioGroup
            value={season}
            onValueChange={(v) => setSeason(v as "spring" | "fall")}
            className="grid grid-cols-2 gap-2"
            aria-label="Sow season"
          >
            <label
              htmlFor="natives-season-spring"
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border p-3 has-[:checked]:border-primary"
            >
              <RadioGroupItem value="spring" id="natives-season-spring" />
              <span className="text-sm">Spring</span>
            </label>
            <label
              htmlFor="natives-season-fall"
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border p-3 has-[:checked]:border-primary"
            >
              <RadioGroupItem value="fall" id="natives-season-fall" />
              <span className="text-sm">Fall dormant</span>
            </label>
          </RadioGroup>
        </fieldset>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </form>

      {data && (
        <section className="space-y-4" aria-live="polite">
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">
                {data.ecoregion ? data.ecoregion.name : "Ecoregion unknown"}
              </h2>
              {data.ecoregion && (
                <Badge variant="outline">L3 {data.ecoregion.id}</Badge>
              )}
              <Badge variant="outline">{isFall ? "Fall" : "Spring"}</Badge>
              <Badge variant="secondary" className="capitalize">
                {data.frostSource} frost
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Zone {data.zone.toUpperCase()} · {frostLabel} ~{" "}
              {new Date(`${data.lastFrostDate}T12:00:00`).toLocaleDateString(
                undefined,
                { month: "short", day: "numeric", year: "numeric" },
              )}
            </p>
            <p className="text-muted-foreground text-xs">
              Native to this EPA Level III ecoregion — not a guarantee for your
              yard. Nativity: USDA PLANTS. Timing: frost p50 + curated offsets.
              {isFall && " Fall list shows species suited to dormant sowing."}
            </p>
          </header>

          {data.catalogCoverage === "none" && (
            <p className="text-sm">
              Ecoregion mapped; plant catalog coming. Meanwhile use the{" "}
              <Link href="/" className="underline">
                vegetable planner
              </Link>
              .
            </p>
          )}

          {data.catalogCoverage === "unknown" && (
            <p className="text-sm">
              No ecoregion match for this ZIP (often AK/HI/territories). Try a
              continental US ZIP.
            </p>
          )}

          {data.plants.length === 0 && data.catalogCoverage === "full" && isFall && (
            <p className="text-sm">
              No fall-dormant entries for this ecoregion yet. Try Spring.
            </p>
          )}

          {data.plants.length > 0 && (
            <ul className="divide-y border-y">
              {data.plants.map((p) => (
                <li key={p.id} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.commonName}</p>
                      <p className="text-muted-foreground text-sm italic">
                        {p.scientificName}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {p.habit}
                    </Badge>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {p.tasks.map((t) => (
                      <li key={`${t.type}-${t.date}`}>
                        {t.label} —{" "}
                        {new Date(`${t.date}T12:00:00`).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </li>
                    ))}
                  </ul>
                  {p.needsStratification && !isFall && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Benefits from cold stratification (see sow window).
                    </p>
                  )}
                  <a
                    href={p.sourceUrl}
                    className="text-muted-foreground mt-2 inline-block text-xs underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    USDA PLANTS source
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
