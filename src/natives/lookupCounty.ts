import data from "../../data/natives/zip-county.json";

type CountyRef = { fips: string; name: string; state: string };

type ZipCountyFile = {
  zips: Record<string, string>;
  counties: Record<string, { name: string; state: string }>;
};

const file = data as ZipCountyFile;

/** Primary county for ZIP (Census ZCTA max-pop share). Overlay only. */
export function lookupZipCounty(zip: string): CountyRef | null {
  const fips = file.zips[zip];
  if (!fips) return null;
  const meta = file.counties[fips];
  if (!meta) return null;
  return { fips, name: meta.name, state: meta.state };
}
