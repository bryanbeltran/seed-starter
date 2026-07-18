import { format } from "date-fns";
import { getFileClimateRepository } from "@/climate";
import { resolveLastFrost } from "@/planning";
import { apiRoute } from "@/lib/apiRoute";
import { resolveLocation } from "@/lib/resolveLocation";
import { normalizeZip, ZoneLookupError } from "@/lib/zipToZone";

const climateRepository = getFileClimateRepository();

export const GET = apiRoute("location", async (req) => {
  const raw = new URL(req.url).searchParams.get("zip") ?? "";
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
    const frost = resolveLastFrost({ zone, zip }, climateRepository);
    return Response.json({
      zip,
      zone,
      lastFrostP50: format(frost.lastFrostDate, "yyyy-MM-dd"),
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
