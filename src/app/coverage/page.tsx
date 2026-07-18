import Link from "next/link";
import { computeCoverageStats } from "@/lib/climateCoverage";

export default function CoveragePage() {
  const stats = computeCoverageStats();
  const m = stats.manifest;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Planner
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Climate coverage
        </h1>
        <p className="mt-2 text-muted-foreground">
          Nationwide frost data plane health. Outliers beyond{" "}
          {stats.thresholds.outlierKm} km fall back to station/regional/zone.
        </p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Stat label="ZIP records" value={String(m.zipCount)} />
        <Stat label="Data version" value={m.dataVersion} />
        <Stat label="TMIN stations" value={String(m.tminStationCount)} />
        <Stat label="Station pool" value={String(m.stationPoolCount)} />
        <Stat label="Median distance" value={`${m.medianDistanceKm} km`} />
        <Stat label="p95 distance" value={`${m.p95DistanceKm} km`} />
        <Stat
          label="Zone fill"
          value={`${(m.zoneFillRate * 100).toFixed(1)}%`}
        />
        <Stat label="Skipped ZIPs" value={String(m.skippedCount)} />
      </dl>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Confidence (usable tier)</h2>
        <p className="text-sm text-muted-foreground">
          high ≤{stats.thresholds.highKm} km · medium ≤{stats.thresholds.mediumKm}{" "}
          km · low ≤{stats.thresholds.outlierKm} km
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="High" value={String(stats.confidence.high)} />
          <Stat label="Medium" value={String(stats.confidence.medium)} />
          <Stat label="Low" value={String(stats.confidence.low)} />
          <Stat label="Outliers (rejected)" value={String(stats.outliers)} />
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Computed {m.computedAt}. See{" "}
        <Link href="/docs" className="underline">
          API docs
        </Link>{" "}
        and <code className="text-xs">docs/data-sources.md</code>.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
