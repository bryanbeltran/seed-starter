export function AppFooter() {
  return (
    <footer className="text-muted-foreground mt-12 border-t px-4 py-6 text-center text-xs print:hidden">
      <p>
        Frost data: NOAA station fixtures, regional estimates, USDA zone medians.
        Zones: offline fixture +{" "}
        <a href="https://phzmapi.org/" className="underline" rel="noreferrer">
          PHZM API
        </a>
        .
      </p>
    </footer>
  );
}
