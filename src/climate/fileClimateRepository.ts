import zipClimateData from "../../data/zipClimate.json";
import type { ClimateRecord, ClimateRepository } from "./types";

const records = zipClimateData as Record<string, ClimateRecord>;

let instance: ClimateRepository | null = null;

export function getFileClimateRepository(): ClimateRepository {
  if (!instance) {
    instance = {
      getByZip(zip: string) {
        return records[zip];
      },
    };
  }
  return instance;
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
