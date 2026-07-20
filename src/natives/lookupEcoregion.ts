import zipEcoregionData from "../../data/natives/zip-ecoregion.json";

export type EcoregionRef = { id: string; name: string };

type ZipEcoregionFile = {
  names: Record<string, string>;
  zips: Record<string, string>;
};

const file = zipEcoregionData as ZipEcoregionFile;

export function lookupZipEcoregion(zip: string): EcoregionRef | null {
  const id = file.zips[zip];
  if (!id) return null;
  return { id, name: file.names[id] ?? id };
}
