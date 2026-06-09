import { subDays } from "date-fns";
import { lastFrostDateForZone } from "@/planning/frost";
import { cropOffsets } from "./cropOffsets";
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
    date: subDays(frostDate, cropOffsets[seed] ?? 30),
  }));

  return { zone, sowDates };
}
