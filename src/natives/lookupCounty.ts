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
export function lookupZipCountyFipsFromData(
  zip: string,
  countyData: ZipCountyFile,
): string[] {
  const intersections = countyData.intersections?.[zip];
  if (
    !Array.isArray(intersections) ||
    intersections.length === 0 ||
    intersections.some(({ fips }) => !/^\d{5}$/.test(fips))
  ) {
    return [];
  }
  return [...new Set(intersections.map(({ fips }) => fips))];
}

export function lookupZipCountyFips(zip: string): string[] {
  return lookupZipCountyFipsFromData(zip, file);
}

/** True only for a FIPS key present in the bundled Census county relationship data. */
export function isKnownCountyFips(fips: string): boolean {
  return /^\d{5}$/.test(fips) && Object.hasOwn(file.counties ?? {}, fips);
}

/** True only for a ZCTA key present in the loaded Census relationship data. */
export function isKnownZctaIdFromData(zip: string, countyData: ZipCountyFile): boolean {
  return /^\d{5}$/.test(zip) && (
    Object.hasOwn(countyData.zips ?? {}, zip) ||
    Object.hasOwn(countyData.intersections ?? {}, zip)
  );
}

export function isKnownZctaId(zip: string): boolean {
  return isKnownZctaIdFromData(zip, file);
}
