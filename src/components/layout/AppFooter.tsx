import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="text-muted-foreground mt-12 border-t px-4 py-6 text-center text-xs print:hidden">
      <p>
        Frost data: NOAA GHCN nearest-station percentiles with station → regional
        → zone fallbacks. Zones: PRISM 2023 +{" "}
        <a href="https://phzmapi.org/" className="underline" rel="noreferrer">
          PHZM API
        </a>
        .
      </p>
      <p className="mt-2 space-x-3">
        <Link href="/natives" className="underline">
          Natives
        </Link>
        <Link href="/coverage" className="underline">
          Coverage
        </Link>
        <Link href="/docs" className="underline">
          API docs
        </Link>
        <a href="/api/health" className="underline">
          Health
        </a>
      </p>
    </footer>
  );
}
