import zipClimateData from "../../data/zipClimate.json";
import type { ClimateRecord, ClimateRepository } from "./types";

const records = zipClimateData as Record<string, ClimateRecord>;
const zipCache = new Map<string, ClimateRecord | undefined>();

let instance: ClimateRepository | null = null;

export function getFileClimateRepository(): ClimateRepository {
  if (!instance) {
    instance = {
      getByZip(zip: string) {
        if (!zipCache.has(zip)) zipCache.set(zip, records[zip]);
        return zipCache.get(zip);
      },
    };
  }
  return instance;
}

export function getClimateSnapshotId(zip: string): string | null {
  return records[zip]?.dataVersion ?? null;
}

export const emptyClimateRepository: ClimateRepository = {
  getByZip: () => undefined,
};

export function getCurrentClimateDataVersion(): string {
  const versions = new Set(
    Object.values(records).map((r) => r.dataVersion).filter(Boolean),
  );
  if (versions.size === 1) return [...versions][0];
  return records[Object.keys(records)[0]]?.dataVersion ?? "unknown";
}

export function isClimateVersionStale(stored: string | null | undefined): boolean {
  if (!stored) return true;
  return stored !== getCurrentClimateDataVersion();
}
