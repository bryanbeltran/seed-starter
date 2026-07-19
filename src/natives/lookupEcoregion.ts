import zipEcoregionData from "../../data/natives/zip-ecoregion.json";

export type EcoregionRef = { id: string; name: string };

type ZipEcoregionFile = {
  zips: Record<string, EcoregionRef>;
};

const file = zipEcoregionData as ZipEcoregionFile;

export function lookupZipEcoregion(zip: string): EcoregionRef | null {
  return file.zips[zip] ?? null;
}
