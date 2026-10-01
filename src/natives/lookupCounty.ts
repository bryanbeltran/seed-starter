import data from "../../data/natives/zip-county.json";

type CountyRef = { fips: string; name: string; state: string };

type ZipCountyFile = {
  zips: Record<string, string>;
  counties: Record<string, { name: string | null; state: string }>;
  intersections?: Record<string, { fips: string }[]>;
};

const file = data as ZipCountyFile;

/** Primary county for ZIP (Census ZCTA max-pop share). Overlay only. */
export function lookupZipCounty(zip: string): CountyRef | null {
  const fips = file.zips[zip];
  if (!fips) return null;
  const meta = file.counties[fips];
  if (!meta?.name || !meta.state || meta.state === "??") return null;
  return { fips, name: meta.name, state: meta.state };
}

/** Census county FIPS values for every county intersecting this ZCTA. */
export function lookupZipCountyFips(zip: string): string[] {
  const intersections = file.intersections?.[zip];
  if (intersections) {
    return [...new Set(intersections.map(({ fips }) => fips))];
  }
  const primaryCounty = file.zips[zip];
  return primaryCounty ? [primaryCounty] : [];
}
