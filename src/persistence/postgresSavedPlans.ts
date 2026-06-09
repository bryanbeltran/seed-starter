import { neon } from "@neondatabase/serverless";
import { getCurrentClimateDataVersion } from "@/climate";
import type { RiskProfile } from "@/planning";
import { resolveLocation } from "@/lib/resolveLocation";
import {
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
  climate_data_version: string | null;
  climate_snapshot_id: string | null;
  created_at: string;
  updated_at: string;
};

let migrated = false;

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for Postgres persistence.");
  return neon(url);
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
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`
    ALTER TABLE saved_plans ADD COLUMN IF NOT EXISTS climate_snapshot_id TEXT
  `;
  migrated = true;
}

async function planFromRow(row: PlanRow): Promise<SavedPlan> {
  const crops = JSON.parse(row.crops_json) as string[];
  const schedule = await scheduleForPlan(
    row.zip,
    row.zone,
    crops,
    row.risk_profile as RiskProfile,
  );
  return rowToPlan(row, schedule);
}

export async function listSavedPlans(): Promise<SavedPlan[]> {
  await ensureMigrations();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM saved_plans ORDER BY updated_at DESC
  `) as PlanRow[];
  return Promise.all(rows.map(planFromRow));
}

export async function getSavedPlan(id: string): Promise<SavedPlan | null> {
  await ensureMigrations();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM saved_plans WHERE id = ${id}
  `) as PlanRow[];
  if (!rows[0]) return null;
  return planFromRow(rows[0]);
}

export async function createSavedPlan(input: SavedPlanInput): Promise<SavedPlan> {
  const { zip, zone } = await resolveLocation(input.zip);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const riskProfile = input.riskProfile ?? "balanced";
  const climateDataVersion = getCurrentClimateDataVersion();
  const climateSnapshotId = climateSnapshotForZip(zip) ?? climateDataVersion;

  await ensureMigrations();
  const sql = getSql();
  await sql`
    INSERT INTO saved_plans (id, name, zip, zone, crops_json, risk_profile, climate_data_version, climate_snapshot_id, created_at, updated_at)
    VALUES (${id}, ${input.name}, ${zip}, ${zone}, ${JSON.stringify(input.crops)}, ${riskProfile}, ${climateDataVersion}, ${climateSnapshotId}, ${now}, ${now})
  `;

  const schedule = await scheduleForPlan(zip, zone, input.crops, riskProfile);
  return rowToPlan(
    {
      id,
      name: input.name,
      zip,
      zone,
      crops_json: JSON.stringify(input.crops),
      risk_profile: riskProfile,
      climate_data_version: climateDataVersion,
      climate_snapshot_id: climateSnapshotId,
      created_at: now,
      updated_at: now,
    },
    schedule,
  );
}

export async function updateSavedPlan(
  id: string,
  patch: Partial<SavedPlanInput>,
): Promise<SavedPlan | null> {
  const existing = await getSavedPlan(id);
  if (!existing) return null;

  const name = patch.name ?? existing.name;
  const crops = patch.crops ?? existing.crops;
  const riskProfile = patch.riskProfile ?? existing.riskProfile;
  const zip = patch.zip ?? existing.zip;
  const { zone } = await resolveLocation(zip);
  const now = new Date().toISOString();
  const climateDataVersion = getCurrentClimateDataVersion();
  const climateSnapshotId = climateSnapshotForZip(zip) ?? climateDataVersion;

  await ensureMigrations();
  const sql = getSql();
  await sql`
    UPDATE saved_plans
    SET name = ${name}, zip = ${zip}, zone = ${zone}, crops_json = ${JSON.stringify(crops)},
        risk_profile = ${riskProfile}, climate_data_version = ${climateDataVersion},
        climate_snapshot_id = ${climateSnapshotId}, updated_at = ${now}
    WHERE id = ${id}
  `;

  const schedule = await scheduleForPlan(zip, zone, crops, riskProfile);
  return rowToPlan(
    {
      id,
      name,
      zip,
      zone,
      crops_json: JSON.stringify(crops),
      risk_profile: riskProfile,
      climate_data_version: climateDataVersion,
      climate_snapshot_id: climateSnapshotId,
      created_at: existing.createdAt,
      updated_at: now,
    },
    schedule,
  );
}

export async function deleteSavedPlan(id: string): Promise<boolean> {
  const existing = await getSavedPlan(id);
  if (!existing) return false;
  await ensureMigrations();
  const sql = getSql();
  await sql`DELETE FROM saved_plans WHERE id = ${id}`;
  return true;
}
