import { climateConfidence, type ClimateConfidence } from "@/lib/climateConfidence";
import stationData from "./data/stationFrost.json";
import regionalData from "./data/regionalFrost.json";
import { frostDateStringForZone, nextFrostDate } from "./frost";
import type { FrostClimateLookup, FrostModelSource } from "./types";

type StationRecord = {
  name: string;
  zips: string[];
  lastFrost: string;
  provenance: string;
};

type RegionalRecord = {
  name: string;
  zones: string[];
  lastFrost: string;
  provenance: string;
};

const stations = stationData as Record<string, StationRecord>;
const regions = regionalData as Record<string, RegionalRecord>;

export type { FrostModelSource };

export type FrostResolution = {
  lastFrostDate: Date;
  lastFrostP10?: Date;
  lastFrostP90?: Date;
  source: FrostModelSource;
  provenance: string;
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

export function resolveLastFrost(
  input: {
    zone: string;
    zip?: string;
    referenceDate?: Date;
  },
  climateLookup?: FrostClimateLookup,
): FrostResolution {
  const referenceDate = input.referenceDate ?? new Date();

  if (input.zip && climateLookup) {
    const climate = climateLookup.getByZip(input.zip);
    if (climate) {
      const p50 = parseFrostString(climate.lastFrostP50, referenceDate);
      const confidence = climateConfidence(climate.distanceKm);
      return {
        lastFrostDate: p50,
        lastFrostP10: parseFrostString(climate.lastFrostP10, referenceDate),
        lastFrostP90: parseFrostString(climate.lastFrostP90, referenceDate),
        source: "climate",
        provenance: `${climate.provenance} via ${climate.stationName ?? climate.stationId} (${climate.distanceKm}km, ${confidence} confidence)`,
        dataVersion: climate.dataVersion,
        stationId: climate.stationId,
        distanceKm: climate.distanceKm,
        confidence,
      };
    }
  }

  if (input.zip) {
    const station = stationForZip(input.zip);
    if (station) {
      return {
        lastFrostDate: parseFrostString(station.lastFrost, referenceDate),
        source: "station",
        provenance: station.provenance,
      };
    }
  }

  const regional = regionForZone(input.zone);
  if (regional) {
    return {
      lastFrostDate: parseFrostString(regional.lastFrost, referenceDate),
      source: "regional",
      provenance: regional.provenance,
    };
  }

  const zoneStr = frostDateStringForZone(input.zone);
  return {
    lastFrostDate: parseFrostString(zoneStr, referenceDate),
    source: "zone",
    provenance: "USDA hardiness zone median last-frost estimate",
  };
}
