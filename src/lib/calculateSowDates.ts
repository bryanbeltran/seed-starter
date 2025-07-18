// src/lib/calculateSowDates.ts
import { subDays } from "date-fns";
import frostDatesData from "./frostDates.json";
const frostDates: Record<string, string> = frostDatesData;

import { cropOffsets } from "./cropOffsets";
// import { zipToLatLong } from "./zipToLatLong"; // Uncomment when geolocation is needed

const zipToZone: Record<string, string> = {
  "55423": "4a",
  "10001": "7b",
  // …add more ZIP → zone entries as you go…
};

export async function calculateSowDates(zip: string, seeds: string[]) {
  let zone: string;
  try {
    // const { lat, lng } = await zipToLatLong(zip);
    // zone = lookupZoneFromLatLng(lat, lng);
    if (zipToZone[zip]) {
      zone = zipToZone[zip];
    } else {
      console.warn(`Unrecognized ZIP code: ${zip}, defaulting to zone 4a.`);
      zone = "4a";
    }
  } catch (err) {
    console.error("Error determining zone for ZIP:", zip, err);
    zone = "4a";
  }

  const lastFrostStr = frostDates[zone] || frostDates["4a"];
  const [month, day] = lastFrostStr.split("-").map(Number);

  const year = new Date().getFullYear();
  const frostDate = new Date(year, month - 1, day);

  const sowDates = seeds.map((seed) => ({
    seed,
    date: subDays(frostDate, cropOffsets[seed] ?? 30),
  }));

  return { zone, sowDates };
}
