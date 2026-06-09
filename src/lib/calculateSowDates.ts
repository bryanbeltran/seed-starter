import { subDays } from "date-fns";
import frostDatesData from "./frostDates.json";
import { cropOffsets } from "./cropOffsets";
import { zipToZone } from "./zipToZone";

const frostDates: Record<string, string> = frostDatesData;

function nextFrostDate(month: number, day: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const frost = new Date(year, month - 1, day);
  if (frost < today) return new Date(year + 1, month - 1, day);
  return frost;
}

export type SowDateResult = {
  zone: string;
  sowDates: { seed: string; date: Date }[];
};

export async function calculateSowDates(
  zip: string,
  seeds: string[],
): Promise<SowDateResult> {
  const zone = await zipToZone(zip);
  const lastFrostStr = frostDates[zone] ?? frostDates["4a"];
  const [month, day] = lastFrostStr.split("-").map(Number);
  const frostDate = nextFrostDate(month, day);

  const sowDates = seeds.map((seed) => ({
    seed,
    date: subDays(frostDate, cropOffsets[seed] ?? 30),
  }));

  return { zone, sowDates };
}
