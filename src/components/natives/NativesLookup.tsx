"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { RiskProfile } from "@/planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RiskProfilePicker } from "@/components/seed-form/RiskProfilePicker";

type NativeTask = { type: string; date: string; label: string };
type NativeRangeEvidence = {
  sourceCitation: string;
  sourceUrl: string;
  releaseOrObservationDate: string | null;
  retrievedAt: string | null;
  licenseNote: string | null;
  geographicScope: string | null;
  spatialResolution: "county" | "finer" | "state" | "unknown";
  countyFips: string | null;
  nativityStatus: "native" | "not_native" | "unknown";
  uncertainty: string | null;
};
type NativePlant = {
  id: string;
  commonName: string;
  scientificName: string;
  habit: string;
  needsStratification: boolean;
  sourceUrl: string;
  confidence: string;
  rangeEvidence: NativeRangeEvidence[];
  tasks: NativeTask[];
};

type NativeRangeEvidenceCoverage = {
  status:
    | "unresolved_geography"
    | "no_catalog"
    | "no_local_evidence"
    | "affirmative_evidence"
    | "not_native_evidence";
  catalogCandidateCount: number;
  affirmativeCount: number;
  notNativeCount: number;
  unknownCount: number;
  missingCount: number;
};

type NativesResponse = {
  zip: string;
  zone: string;
  season?: string;
  riskProfile?: RiskProfile;
  ecoregion: { id: string; name: string } | null;
  county?: { fips: string; name: string; state: string } | null;
  lastFrostDate: string;
  frostSource: string;
  catalogCoverage: string;
  rangeEvidenceCoverage: NativeRangeEvidenceCoverage;
  plants: NativePlant[];
  error?: string;
};

function isValidZip(zip: string) {
  return /^\d{5}$/.test(zip.replace(/\D/g, ""));
}

function parseRisk(raw: string | null): RiskProfile {
  if (raw === "conservative" || raw === "aggressive") return raw;
  return "balanced";
}

export function NativesLookup() {
  const searchParams = useSearchParams();
  const [zip, setZip] = useState("");
  const [season, setSeason] = useState<"spring" | "fall">("spring");
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NativesResponse | null>(null);

  async function load(
    zipValue: string,
    seasonValue: "spring" | "fall",
    risk: RiskProfile,
  ) {
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
        riskProfile: risk,
      });
      const res = await fetch(`/api/natives?${q}`);
      const body = (await res.json()) as NativesResponse;
      if (!res.ok) {
        setData(null);
        setError(body.error ?? "Lookup failed.");
        return;
      }
      setData(body);
      const url = new URL(window.location.href);
      url.searchParams.set("zip", zipValue.replace(/\D/g, ""));
      url.searchParams.set("season", seasonValue);
      url.searchParams.set("riskProfile", risk);
      window.history.replaceState({}, "", url);
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
    const qRisk = parseRisk(searchParams.get("riskProfile"));
    setSeason(qSeason);
    setRiskProfile(qRisk);
    if (qZip && isValidZip(qZip)) {
      setZip(qZip);
      void load(qZip, qSeason, qRisk);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial deep-link only
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void load(zip, season, riskProfile);
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
              {loading ? "Looking up…" : "Find native plants"}
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
              <span className="text-sm">Fall dormant sowing</span>
            </label>
          </RadioGroup>
        </fieldset>
        <RiskProfilePicker
          value={riskProfile}
          loading={loading}
          onChange={setRiskProfile}
          season={season}
        />
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
              {data.county && (
                <Badge variant="outline">
                  {data.county.name} County, {data.county.state}
                </Badge>
              )}
              <Badge variant="outline">{isFall ? "Fall" : "Spring"}</Badge>
              <Badge variant="outline" className="capitalize">
                {data.riskProfile ?? "balanced"}
              </Badge>
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
              Recommendations require affirmative USDA PLANTS county or finer
              range evidence for the ZIP&apos;s resolved county. EPA Level III
              membership only supplies candidate species; it does not establish
              local nativity. Timing: frost percentiles + curated offsets
              ({data.riskProfile ?? "balanced"}).
              {isFall && " Fall list shows species suited to dormant sowing."}
            </p>
          </header>

          {data.catalogCoverage === "none" && (
            <p className="text-sm">
              No native plant list for this ecoregion yet. Meanwhile use the{" "}
              <Link href="/" className="underline">
                vegetable planner
              </Link>
              .
            </p>
          )}

          {data.catalogCoverage === "unknown" && (
            <p className="text-sm">
              No EPA Level III ecoregion match is available for this ZIP, so no
              candidate species catalog can be selected.
            </p>
          )}

          {data.rangeEvidenceCoverage.status === "unresolved_geography" && (
            <p className="text-sm">
              County or ecoregion geography could not be resolved for this ZIP.
              No local native plant recommendations are available.
            </p>
          )}

          {data.rangeEvidenceCoverage.status === "no_catalog" && (
            <p className="text-sm">
              No candidate species catalog is available for this ecoregion, so
              no local native plant recommendations can be made.
            </p>
          )}

          {data.rangeEvidenceCoverage.status === "no_local_evidence" && (
            <p className="text-sm">
              No candidate has affirmative USDA PLANTS county-range evidence
              for this ZIP. {data.rangeEvidenceCoverage.unknownCount} candidate(s)
              have matching records with unknown or conflicting details, and{" "}
              {data.rangeEvidenceCoverage.missingCount} have no matching record.
              {data.rangeEvidenceCoverage.notNativeCount > 0 &&
                ` ${data.rangeEvidenceCoverage.notNativeCount} have explicit records stating they are not native.`}
              {" "}Missing evidence is unknown, not evidence that a species is
              non-native.
            </p>
          )}

          {data.rangeEvidenceCoverage.status === "not_native_evidence" && (
            <p className="text-sm">
              USDA PLANTS records classify all {data.rangeEvidenceCoverage.notNativeCount} catalog candidates as not native in this county.
            </p>
          )}

          {data.plants.length === 0 &&
            data.rangeEvidenceCoverage.status === "affirmative_evidence" && (
            <p className="text-sm">
              Local native-range evidence is available, but those plants have no
              sowing tasks for this season.
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
                  <div className="mt-2 space-y-1 text-xs">
                    {p.rangeEvidence.map((evidence, index) => (
                      <div key={`${evidence.sourceUrl}-${index}`}>
                        <a
                          href={evidence.sourceUrl}
                          className="underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          USDA PLANTS county-range evidence
                        </a>
                        <p className="text-muted-foreground">
                          {evidence.sourceCitation} · {evidence.spatialResolution} resolution
                          {` · nativity ${evidence.nativityStatus}`}
                          {evidence.countyFips ? ` · county FIPS ${evidence.countyFips}` : ""}
                          {evidence.releaseOrObservationDate
                            ? ` · source date ${evidence.releaseOrObservationDate}`
                            : " · source date unknown"}
                          {evidence.retrievedAt
                            ? ` · retrieved ${evidence.retrievedAt}`
                            : " · retrieval date unknown"}
                          {` · geographic scope ${evidence.geographicScope ?? "unknown"}`}
                        </p>
                        <p className="text-muted-foreground">
                          License: {evidence.licenseNote ?? "unknown"}
                        </p>
                        <p className="text-muted-foreground">
                          Uncertainty: {evidence.uncertainty ?? "unknown"}
                        </p>
                      </div>
                    ))}
                  </div>
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
