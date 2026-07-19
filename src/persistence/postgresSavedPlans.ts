import { neon } from "@neondatabase/serverless";
import { getCurrentClimateDataVersion } from "@/climate";
import type { GardenSeason, RiskProfile } from "@/planning";
import { resolveLocation } from "@/lib/resolveLocation";
import {
  canReadPlan,
  canWritePlan,
  climateSnapshotForZip,
  rowToPlan,
  scheduleForPlan,
  type SavedPlan,
  type SavedPlanInput,
} from "./planHelpers";

type PlanRow = {
  id: string;
  name: string;
  zip: string;
  zone: string;
  crops_json: string;
  risk_profile: string;
  season?: string | null;
  climate_data_version: string | null;
  climate_snapshot_id: string | null;
  owner_id: string | null;
  last_frost_date: string | null;
  created_at: string;
  updated_at: string;
};

let migrated = false;

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for Postgres persistence.");
  return neon(url);
}

/** @internal test helper */
export function resetPostgresMigratedForTests() {
  migrated = false;
}

async function ensureMigrations() {
  if (migrated) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS saved_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      zip TEXT NOT NULL,
      zone TEXT NOT NULL,
      crops_json TEXT NOT NULL,
      risk_profile TEXT NOT NULL DEFAULT 'balanced',
      climate_data_version TEXT,
      climate_snapshot_id TEXT,
      owner_id TEXT,
      last_frost_date TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`ALTER TABLE saved_plans ADD COLUMN IF NOT EXISTS climate_snapshot_id TEXT`;
  await sql`ALTER TABLE saved_plans ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await sql`ALTER TABLE saved_plans ADD COLUMN IF NOT EXISTS last_frost_date TEXT`;
  await sql`ALTER TABLE saved_plans ADD COLUMN IF NOT EXISTS season TEXT NOT NULL DEFAULT 'spring'`;
  await sql`CREATE INDEX IF NOT EXISTS saved_plans_owner_id_idx ON saved_plans (owner_id)`;
  migrated = true;
}

async function fetchRow(id: string): Promise<PlanRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM saved_plans WHERE id = ${id}
  `) as PlanRow[];
  return rows[0] ?? null;
}

async function planFromRow(row: PlanRow): Promise<SavedPlan> {
  const crops = JSON.parse(row.crops_json) as string[];
  const season = (row.season || "spring") as GardenSeason;
  const schedule = await scheduleForPlan(
    row.zip,
    row.zone,
    crops,
    row.risk_profile as RiskProfile,
    season,
  );
  return rowToPlan(row, schedule);
}

export async function listSavedPlans(ownerId?: string | null): Promise<SavedPlan[]> {
  await ensureMigrations();
  const sql = getSql();
  const rows = (
    ownerId
      ? await sql`
          SELECT * FROM saved_plans
          WHERE owner_id = ${ownerId} OR owner_id IS NULL
          ORDER BY updated_at DESC
        `
      : await sql`SELECT * FROM saved_plans ORDER BY updated_at DESC`
  ) as PlanRow[];
  return Promise.all(rows.map(planFromRow));
}

export async function getSavedPlan(
  id: string,
  ownerId?: string | null,
): Promise<SavedPlan | null> {
  await ensureMigrations();
  const row = await fetchRow(id);
  if (!row || !canReadPlan(row.owner_id, ownerId)) return null;
  return planFromRow(row);
}

export async function createSavedPlan(input: SavedPlanInput): Promise<SavedPlan> {
  const { zip, zone } = await resolveLocation(input.zip);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const riskProfile = input.riskProfile ?? "balanced";
  const season = input.season ?? "spring";
  const climateDataVersion = getCurrentClimateDataVersion();
  const climateSnapshotId = climateSnapshotForZip(zip) ?? climateDataVersion;
  const schedule = await scheduleForPlan(zip, zone, input.crops, riskProfile, season);
  const lastFrostDate = schedule.lastFrostDate.toISOString();
  const ownerId = input.ownerId ?? null;

  await ensureMigrations();
  const sql = getSql();
  await sql`
    INSERT INTO saved_plans (id, name, zip, zone, crops_json, risk_profile, season, climate_data_version, climate_snapshot_id, owner_id, last_frost_date, created_at, updated_at)
    VALUES (${id}, ${input.name}, ${zip}, ${zone}, ${JSON.stringify(input.crops)}, ${riskProfile}, ${season}, ${climateDataVersion}, ${climateSnapshotId}, ${ownerId}, ${lastFrostDate}, ${now}, ${now})
  `;

  return rowToPlan(
    {
      id,
      name: input.name,
      zip,
      zone,
      crops_json: JSON.stringify(input.crops),
      risk_profile: riskProfile,
      season,
      climate_data_version: climateDataVersion,
      climate_snapshot_id: climateSnapshotId,
      owner_id: ownerId,
      last_frost_date: lastFrostDate,
      created_at: now,
      updated_at: now,
    },
    schedule,
  );
}

export async function updateSavedPlan(
  id: string,
  patch: Partial<SavedPlanInput>,
  ownerId?: string | null,
): Promise<SavedPlan | null> {
  await ensureMigrations();
  const row = await fetchRow(id);
  if (!row || !canWritePlan(row.owner_id, ownerId)) return null;
  const existing = await planFromRow(row);

  const name = patch.name ?? existing.name;
  const crops = patch.crops ?? existing.crops;
  const riskProfile = patch.riskProfile ?? existing.riskProfile;
  const season = patch.season ?? existing.season;
  const zip = patch.zip ?? existing.zip;
  const { zone } = await resolveLocation(zip);
  const now = new Date().toISOString();
  const climateDataVersion = getCurrentClimateDataVersion();
  const climateSnapshotId = climateSnapshotForZip(zip) ?? climateDataVersion;
  const schedule = await scheduleForPlan(zip, zone, crops, riskProfile, season);
  const lastFrostDate = schedule.lastFrostDate.toISOString();

  await ensureMigrations();
  const sql = getSql();
  await sql`
    UPDATE saved_plans
    SET name = ${name}, zip = ${zip}, zone = ${zone}, crops_json = ${JSON.stringify(crops)},
        risk_profile = ${riskProfile}, season = ${season},
        climate_data_version = ${climateDataVersion},
        climate_snapshot_id = ${climateSnapshotId}, last_frost_date = ${lastFrostDate},
        updated_at = ${now}
    WHERE id = ${id}
  `;

  return rowToPlan(
    {
      id,
      name,
      zip,
      zone,
      crops_json: JSON.stringify(crops),
      risk_profile: riskProfile,
      season,
      climate_data_version: climateDataVersion,
      climate_snapshot_id: climateSnapshotId,
      owner_id: existing.ownerId,
      last_frost_date: lastFrostDate,
      created_at: existing.createdAt,
      updated_at: now,
    },
    schedule,
  );
}

export async function deleteSavedPlan(
  id: string,
  ownerId?: string | null,
): Promise<boolean> {
  await ensureMigrations();
  const row = await fetchRow(id);
  if (!row || !canWritePlan(row.owner_id, ownerId)) return false;
  const sql = getSql();
  await sql`DELETE FROM saved_plans WHERE id = ${id}`;
  return true;
}
