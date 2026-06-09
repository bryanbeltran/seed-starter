import { subDays } from "date-fns";
import { lastFrostDateForZone } from "@/planning/frost";
import { getCropOrDefault } from "@/planning/cropCatalog";
import { zipToZone } from "./zipToZone";

export type SowDateResult = {
  zone: string;
  sowDates: { seed: string; date: Date }[];
};

export async function calculateSowDates(
  zip: string,
  seeds: string[],
): Promise<SowDateResult> {
  const zone = await zipToZone(zip);
  const frostDate = lastFrostDateForZone(zone);

  const sowDates = seeds.map((seed) => ({
    seed,
    date: subDays(frostDate, getCropOrDefault(seed).indoorSowOffsetDays),
  }));

  return { zone, sowDates };
}
