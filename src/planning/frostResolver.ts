import stationData from "./data/stationFrost.json";
import regionalData from "./data/regionalFrost.json";
import { frostDateStringForZone, nextFrostDate } from "./frost";
import type { FrostModelSource } from "./types";

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
  source: FrostModelSource;
  provenance: string;
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

export function resolveLastFrost(input: {
  zone: string;
  zip?: string;
  referenceDate?: Date;
}): FrostResolution {
  const referenceDate = input.referenceDate ?? new Date();

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
