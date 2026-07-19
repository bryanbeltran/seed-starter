import { climateConfidence, type ClimateConfidence } from "@/lib/climateConfidence";
import stationData from "./data/stationFrost.json";
import regionalData from "./data/regionalFrost.json";
import { frostDateStringForZoneBySeason, nextFrostDate } from "./frost";
import type { FrostClimateLookup, FrostModelSource, GardenSeason } from "./types";

type StationRecord = {
  name: string;
  zips: string[];
  lastFrost: string;
  firstFallFrost?: string;
  provenance: string;
};

type RegionalRecord = {
  name: string;
  zones: string[];
  lastFrost: string;
  firstFallFrost?: string;
  provenance: string;
};

const stations = stationData as Record<string, StationRecord>;
const regions = regionalData as Record<string, RegionalRecord>;

export type { FrostModelSource };

/**
 * Frost resolution. Fields keep the spring-era naming (`lastFrost*`) for
 * back-compat, but hold the appropriate anchor for the season (last spring
 * frost, or first fall frost).
 */
export type FrostResolution = {
  lastFrostDate: Date;
  lastFrostP10?: Date;
  lastFrostP90?: Date;
  source: FrostModelSource;
  provenance: string;
  season?: GardenSeason;
  dataVersion?: string;
  stationId?: string;
  distanceKm?: number;
  confidence?: ClimateConfidence;
};

function parseFrostString(mmdd: string, referenceDate: Date): Date {
  const [month, day] = mmdd.split("-").map(Number);
  return nextFrostDate(month, day, referenceDate);
}

function stationForZip(zip: string): StationRecord | undefined {
  return Object.values(stations).find((s) => s.zips.includes(zip));
}

function regionForZone(zone: string): RegionalRecord | undefined {
  return Object.values(regions).find((r) => r.zones.includes(zone));
}

export function resolveFrost(
  input: {
    zone: string;
    zip?: string;
    referenceDate?: Date;
    season?: GardenSeason;
  },
  climateLookup?: FrostClimateLookup,
): FrostResolution {
  const referenceDate = input.referenceDate ?? new Date();
  const season: GardenSeason = input.season ?? "spring";
  const isFall = season === "fall";

  if (input.zip && climateLookup) {
    const climate = climateLookup.getByZip(input.zip);
    if (climate) {
      const p10Str = isFall ? climate.firstFallFrostP10 : climate.lastFrostP10;
      const p50Str = isFall ? climate.firstFallFrostP50 : climate.lastFrostP50;
      const p90Str = isFall ? climate.firstFallFrostP90 : climate.lastFrostP90;
      if (p10Str && p50Str && p90Str) {
        const p50 = parseFrostString(p50Str, referenceDate);
        const confidence = climateConfidence(climate.distanceKm);
        return {
          lastFrostDate: p50,
          lastFrostP10: parseFrostString(p10Str, referenceDate),
          lastFrostP90: parseFrostString(p90Str, referenceDate),
          source: "climate",
          provenance: `${climate.provenance} via ${climate.stationName ?? climate.stationId} (${climate.distanceKm}km, ${confidence} confidence)`,
          season,
          dataVersion: climate.dataVersion,
          stationId: climate.stationId,
          distanceKm: climate.distanceKm,
          confidence,
        };
      }
    }
  }

  if (input.zip) {
    const station = stationForZip(input.zip);
    const stationDate = isFall ? station?.firstFallFrost : station?.lastFrost;
    if (station && stationDate) {
      return {
        lastFrostDate: parseFrostString(stationDate, referenceDate),
        source: "station",
        provenance: station.provenance,
        season,
      };
    }
  }

  const regional = regionForZone(input.zone);
  const regionalDate = isFall ? regional?.firstFallFrost : regional?.lastFrost;
  if (regional && regionalDate) {
    return {
      lastFrostDate: parseFrostString(regionalDate, referenceDate),
      source: "regional",
      provenance: regional.provenance,
      season,
    };
  }

  const zoneStr = frostDateStringForZoneBySeason(input.zone, season);
  return {
    lastFrostDate: parseFrostString(zoneStr, referenceDate),
    source: "zone",
    provenance: isFall
      ? "USDA hardiness zone median first-fall-frost estimate"
      : "USDA hardiness zone median last-frost estimate",
    season,
  };
}

export function resolveLastFrost(
  input: { zone: string; zip?: string; referenceDate?: Date },
  climateLookup?: FrostClimateLookup,
): FrostResolution {
  return resolveFrost({ ...input, season: "spring" }, climateLookup);
}

/** First-fall-frost resolver mirroring the spring fallback chain. */
export function resolveFirstFallFrost(
  input: { zone: string; zip?: string; referenceDate?: Date },
  climateLookup?: FrostClimateLookup,
): FrostResolution {
  return resolveFrost({ ...input, season: "fall" }, climateLookup);
}
