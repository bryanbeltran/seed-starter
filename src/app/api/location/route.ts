import { format } from "date-fns";
import { getFileClimateRepository } from "@/climate";
import { resolveFrost, type GardenSeason } from "@/planning";
import { apiRoute } from "@/lib/apiRoute";
import { resolveLocation } from "@/lib/resolveLocation";
import { normalizeZip, ZoneLookupError } from "@/lib/zipToZone";

const climateRepository = getFileClimateRepository();

export const GET = apiRoute("location", async (req) => {
  const params = new URL(req.url).searchParams;
  const raw = params.get("zip") ?? "";
  const seasonParam = params.get("season");
  const season: GardenSeason =
    seasonParam === "fall" || seasonParam === "summer" ? seasonParam : "spring";

  let zip: string;
  try {
    zip = normalizeZip(raw);
  } catch (err) {
    if (err instanceof ZoneLookupError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  try {
    const { zone } = await resolveLocation(zip);
    const frost = resolveFrost({ zone, zip, season }, climateRepository);
    const spring = resolveFrost({ zone, zip, season: "spring" }, climateRepository);
    const fall = resolveFrost({ zone, zip, season: "fall" }, climateRepository);
    return Response.json({
      zip,
      zone,
      season,
      lastFrostP50: format(frost.lastFrostDate, "yyyy-MM-dd"),
      lastSpringFrostP50: format(spring.lastFrostDate, "yyyy-MM-dd"),
      firstFallFrostP50: format(fall.lastFrostDate, "yyyy-MM-dd"),
      frostSource: frost.source,
      climateConfidence: frost.confidence ?? null,
      stationDistanceKm: frost.distanceKm ?? null,
    });
  } catch (err) {
    if (err instanceof ZoneLookupError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}, { limit: 120 });
