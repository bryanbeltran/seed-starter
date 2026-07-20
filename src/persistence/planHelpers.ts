import {
  getClimateSnapshotId,
  getFileClimateRepository,
  isClimateVersionStale,
} from "@/climate";
import type { GardenSeason, RiskProfile, Schedule } from "@/planning";
import { buildSchedule } from "@/planning";
import { serializeSchedule } from "@/lib/serializeSchedule";
import { diffSchedules, type ScheduleDiff } from "@/lib/scheduleDiff";

export type SavedPlanInput = {
  name: string;
  zip: string;
  crops: string[];
  /** cropId → varietyId */
  varieties?: Record<string, string>;
  riskProfile?: RiskProfile;
  season?: GardenSeason;
  ownerId?: string | null;
};

/** Open mode (no ownerId) reads all. Auth mode: own + legacy unowned. */
export function canReadPlan(
  rowOwnerId: string | null | undefined,
  ownerId?: string | null,
): boolean {
  if (!ownerId) return true;
  return !rowOwnerId || rowOwnerId === ownerId;
}

/** Open mode writes all. Auth mode: only matching owner_id (no orphan takeover). */
export function canWritePlan(
  rowOwnerId: string | null | undefined,
  ownerId?: string | null,
): boolean {
  if (!ownerId) return true;
  return Boolean(rowOwnerId) && rowOwnerId === ownerId;
}

export type SavedPlan = {
  id: string;
  name: string;
  zip: string;
  zone: string;
  crops: string[];
  varieties: Record<string, string>;
  riskProfile: RiskProfile;
  season: GardenSeason;
  ownerId: string | null;
  climateDataVersion: string | null;
  climateSnapshotId: string | null;
  climateDataStale: boolean;
  scheduleDiff: ScheduleDiff | null;
  createdAt: string;
  updatedAt: string;
  schedule: ReturnType<typeof serializeSchedule>;
};

const climateRepository = getFileClimateRepository();

export async function scheduleForPlan(
  zip: string,
  zone: string,
  crops: string[],
  riskProfile: RiskProfile,
  season: GardenSeason = "spring",
  varieties: Record<string, string> = {},
): Promise<Schedule> {
  return buildSchedule({
    zone,
    zip,
    crops,
    cropSelections: crops.map((cropId) => ({
      cropId,
      ...(varieties[cropId] ? { varietyId: varieties[cropId] } : {}),
    })),
    riskProfile,
    season,
    climateRepository,
  });
}

export function parseVarietiesJson(raw: unknown): Record<string, string> {
  if (raw == null || raw === "") return {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function climateSnapshotForZip(zip: string): string | null {
  return (
    getClimateSnapshotId(zip) ??
    getFileClimateRepository().getByZip(zip)?.dataVersion ??
    null
  );
}

function storedScheduleStub(row: Record<string, unknown>): Schedule | null {
  const lastFrost = row.last_frost_date ? String(row.last_frost_date) : null;
  if (!lastFrost) return null;
  return {
    zone: String(row.zone),
    zip: String(row.zip),
    season: (row.season ? String(row.season) : "spring") as GardenSeason,
    lastFrostDate: new Date(lastFrost),
    frostSource: "climate",
    frostProvenance: "stored snapshot",
    riskProfile: String(row.risk_profile) as RiskProfile,
    tasks: [],
  };
}

export function rowToPlan(
  row: Record<string, unknown>,
  schedule: Schedule,
): SavedPlan {
  const storedVersion = row.climate_data_version
    ? String(row.climate_data_version)
    : null;

  const storedSnapshot = row.climate_snapshot_id
    ? String(row.climate_snapshot_id)
    : storedVersion;

  const stale = isClimateVersionStale(storedSnapshot ?? storedVersion);
  const previous = storedScheduleStub(row);
  const scheduleDiff =
    stale && previous ? diffSchedules(previous, schedule) : null;

  return {
    id: String(row.id),
    name: String(row.name),
    zip: String(row.zip),
    zone: String(row.zone),
    crops: JSON.parse(String(row.crops_json)) as string[],
    varieties: parseVarietiesJson(row.varieties_json),
    riskProfile: String(row.risk_profile) as RiskProfile,
    season: (row.season ? String(row.season) : "spring") as GardenSeason,
    ownerId: row.owner_id ? String(row.owner_id) : null,
    climateDataVersion: storedVersion,
    climateSnapshotId: storedSnapshot,
    climateDataStale: stale,
    scheduleDiff,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    schedule: serializeSchedule(schedule),
  };
}
