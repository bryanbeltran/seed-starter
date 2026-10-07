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
  sourceId: string;
  sourceCitation: string;
  sourceUrl: string;
  releaseOrObservationDate: string | null;
  retrievedAt: string | null;
  licenseNote: string | null;
  geographicScope: string | null;
  spatialResolution: "county" | "finer" | "state" | "unknown";
  countyFips: string | null;
  finerArea?: { geography: "census-zcta-2010"; zctaId: string };
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
  rangeEvidenceConflicts?: NativeRangeEvidence[];
  tasks: NativeTask[];
};
type NativeRangeEvidenceConflict = {
  plantId: string;
  commonName: string;
  scientificName: string;
  claims: NativeRangeEvidence[];
  recommended: boolean;
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
  conflictCount: number;
  unknownCount: number;
  unknownCountyCount: number;
  missingCount: number;
  countyIntersectionCount: number;
  evidenceSourceIds: string[];
  affirmativeSourceIds: string[];
  notNativeSourceIds: string[];
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
  rangeEvidenceConflicts: NativeRangeEvidenceConflict[];
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

function evidenceSourceName(sourceId: string): string {
  if (sourceId === "usda-plants") return "USDA PLANTS";
  if (sourceId === "bonap-napa") return "BONAP NAPA";
  return sourceId;
}

function formatEvidenceSources(sourceIds: string[]): string {
  const names = [...new Set(sourceIds.map(evidenceSourceName))];
  if (names.length < 2) return names[0] ?? "eligible source records";
  if (names.length === 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
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
  const recommendationSourceIds = data?.plants.flatMap((plant) =>
    plant.rangeEvidence.map((evidence) => evidence.sourceId),
  ) ?? [];
  const recommendationEvidence = data?.plants.flatMap((plant) => plant.rangeEvidence) ?? [];
  const hasFinerRecommendationEvidence = recommendationEvidence.some(
    (evidence) => evidence.spatialResolution === "finer",
  );
  const hasCountyRecommendationEvidence = recommendationEvidence.some(
    (evidence) => evidence.spatialResolution === "county",
  );

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
              Recommendations require affirmative eligible nativity evidence
              either directly covering this ZIP or covering every intersecting
              county. The
              county badge shows the primary ZIP overlay. EPA Level III
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
              No candidate has affirmative eligible range evidence covering
              this ZIP. {data.rangeEvidenceCoverage.evidenceSourceIds.length > 0 &&
                `Eligible records from ${formatEvidenceSources(data.rangeEvidenceCoverage.evidenceSourceIds)} were observed, but the coverage is incomplete, unknown, or conflicting. `}
              {data.rangeEvidenceCoverage.unknownCount} candidate(s)
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
              Eligible records from {formatEvidenceSources(data.rangeEvidenceCoverage.notNativeSourceIds)}
              {" "}classify all {data.rangeEvidenceCoverage.notNativeCount} catalog candidates as not native for this ZIP.
            </p>
          )}

          {data.rangeEvidenceCoverage.conflictCount > 0 && (
            <p className="text-sm">
              {data.rangeEvidenceCoverage.conflictCount} candidate(s) have opposing eligible nativity claims within a county or between whole-ZCTA and county evidence. The conflicting claims are listed below for review.
            </p>
          )}

          {data.rangeEvidenceCoverage.unknownCountyCount > 0 &&
            data.rangeEvidenceCoverage.status !== "no_local_evidence" && (
            <p className="text-sm">
              {data.rangeEvidenceCoverage.unknownCountyCount} candidate(s) also have county nativity evidence with unknown status. Unknown evidence remains unclassified and is not counted as a conflicting claim.
            </p>
          )}

          {data.rangeEvidenceConflicts?.length > 0 && (
            <div
              className="space-y-3 rounded-md border p-4"
              role="region"
              aria-label="Conflicting nativity evidence"
            >
              <div>
                <h3 className="font-medium">Conflicting nativity evidence</h3>
                <p className="text-muted-foreground text-sm">
                  Both sides of each opposing claim set are shown with source, date, resolution, and status. County disagreements do not establish whole-ZIP nativity.
                </p>
              </div>
              <ul className="divide-y">
                {data.rangeEvidenceConflicts.map((conflict) => (
                  <li key={conflict.plantId} className="space-y-2 py-3">
                    <div>
                      <p className="font-medium">{conflict.commonName}</p>
                      <p className="text-muted-foreground text-sm italic">{conflict.scientificName}</p>
                      <p className="text-muted-foreground text-sm">
                        {conflict.recommended
                          ? "Also included in recommendations based on affirmative eligible evidence."
                          : "Not included in recommendations for this ZIP."}
                      </p>
                    </div>
                    <ul className="space-y-2 text-xs">
                      {conflict.claims.map((evidence, index) => (
                        <li key={`${evidence.sourceUrl}-${evidence.countyFips}-${index}`}>
                          <a
                            href={evidence.sourceUrl}
                            className="underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {evidenceSourceName(evidence.sourceId)}{" "}
                            {evidence.spatialResolution === "finer"
                              ? "whole-ZCTA evidence"
                              : "county evidence"}
                          </a>
                          <p className="text-muted-foreground">
                            {evidence.sourceCitation} · {evidence.spatialResolution} resolution
                            {` · nativity ${evidence.nativityStatus}`}
                            {evidence.countyFips ? ` · county FIPS ${evidence.countyFips}` : ""}
                            {evidence.finerArea ? ` · ZCTA ${evidence.finerArea.zctaId}` : ""}
                            {evidence.releaseOrObservationDate
                              ? ` · source date ${evidence.releaseOrObservationDate}`
                              : " · source date unknown"}
                            {evidence.retrievedAt
                              ? ` · retrieved ${evidence.retrievedAt}`
                              : " · retrieval date unknown"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.plants.length > 0 && (
            <p className="text-sm">
              Recommendations below have affirmative eligible nativity evidence from{" "}
              {formatEvidenceSources(recommendationSourceIds)}{" "}
              {hasFinerRecommendationEvidence && !hasCountyRecommendationEvidence
                ? "directly covering this whole ZCTA."
                : hasCountyRecommendationEvidence && !hasFinerRecommendationEvidence
                  ? `across all ${data.rangeEvidenceCoverage.countyIntersectionCount} county intersection${data.rangeEvidenceCoverage.countyIntersectionCount === 1 ? "" : "s"} for this ZIP.`
                  : "covering this ZCTA directly or covering every county intersection, as identified for each plant."}
            </p>
          )}

          {data.plants.length === 0 &&
            data.rangeEvidenceCoverage.status === "affirmative_evidence" && (
            <p className="text-sm">
              Affirmative eligible range evidence from{" "}
              {formatEvidenceSources(data.rangeEvidenceCoverage.affirmativeSourceIds)} covers this ZIP, but those plants have no sowing tasks
              for this season.
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
                          {evidenceSourceName(evidence.sourceId)}{" "}
                          {evidence.spatialResolution === "finer"
                            ? "ZCTA-wide range evidence"
                            : evidence.spatialResolution === "county"
                              ? "county-range evidence"
                              : "range evidence"}
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
                    Catalog taxon source
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
