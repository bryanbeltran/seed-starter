import { format } from "date-fns";
import { getFileClimateRepository } from "@/climate";
import { resolveNatives } from "@/natives";
import type { GardenSeason } from "@/planning";
import { apiRoute } from "@/lib/apiRoute";
import { resolveLocation } from "@/lib/resolveLocation";
import { normalizeZip, ZoneLookupError } from "@/lib/zipToZone";

const climateRepository = getFileClimateRepository();

export const GET = apiRoute(
  "natives",
  async (req) => {
    const params = new URL(req.url).searchParams;
    const raw = params.get("zip") ?? "";
    const season: GardenSeason = params.get("season") === "fall" ? "fall" : "spring";

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
      const result = resolveNatives({
        zip,
        zone,
        season,
        climateLookup: climateRepository,
      });
      const frostLabel =
        season === "fall" ? "firstFallFrostDate" : "lastFrostDate";
      return Response.json({
        zip: result.zip,
        zone: result.zone,
        season: result.season,
        ecoregion: result.ecoregion,
        [frostLabel]: format(result.lastFrostDate, "yyyy-MM-dd"),
        lastFrostDate: format(result.lastFrostDate, "yyyy-MM-dd"),
        frostSource: result.frostSource,
        frostProvenance: result.frostProvenance,
        catalogCoverage: result.catalogCoverage,
        plants: result.plants.map((p) => ({
          id: p.id,
          commonName: p.commonName,
          scientificName: p.scientificName,
          habit: p.habit,
          light: p.light ?? null,
          moisture: p.moisture ?? null,
          needsStratification: Boolean(p.needsStratification),
          fallDormant: Boolean(p.fallDormant),
          sourceUrl: p.sourceUrl,
          confidence: p.confidence,
          tasks: p.tasks.map((t) => ({
            type: t.type,
            date: format(t.date, "yyyy-MM-dd"),
            label: t.label,
          })),
        })),
      });
    } catch (err) {
      if (err instanceof ZoneLookupError) {
        return Response.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  },
  { limit: 120 },
);
