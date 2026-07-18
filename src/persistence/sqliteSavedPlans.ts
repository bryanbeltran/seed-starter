import fs from "fs";
import path from "path";
import initSqlJs, { type Database } from "sql.js";
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

const MIGRATIONS = [
  "001_saved_plans.sql",
  "002_climate_version.sql",
  "003_climate_snapshot.sql",
  "004_owner_and_frost.sql",
];

function dbDir() {
  return process.env.SEEDSTARTER_DB_DIR ?? path.join(process.cwd(), ".seedstarter");
}

function dbPath() {
  return path.join(dbDir(), "seedstarter.sqlite");
}

let dbPromise: Promise<Database> | null = null;
let dbPromisePath: string | null = null;

export function resetDbCacheForTests() {
  dbPromise = null;
  dbPromisePath = null;
}

function hasColumn(db: Database, table: string, column: string): boolean {
  const result = db.exec(`PRAGMA table_info(${table})`);
  if (!result[0]) return false;
  const nameIdx = result[0].columns.indexOf("name");
  return result[0].values.some((row) => row[nameIdx] === column);
}

function runMigrations(db: Database) {
  const migrationsDir = path.join(process.cwd(), "db/migrations");
  for (const file of MIGRATIONS) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8").trim();
    if (sql) db.run(sql);
  }
  for (const col of [
    "climate_data_version",
    "climate_snapshot_id",
    "owner_id",
    "last_frost_date",
  ]) {
    if (!hasColumn(db, "saved_plans", col)) {
      db.run(`ALTER TABLE saved_plans ADD COLUMN ${col} TEXT`);
    }
  }
}

async function getDb(): Promise<Database> {
  const currentPath = dbPath();
  if (!dbPromise || dbPromisePath !== currentPath) {
    dbPromisePath = currentPath;
    dbPromise = (async () => {
      const SQL = await initSqlJs();
      const dir = dbDir();
      fs.mkdirSync(dir, { recursive: true });
      const db = fs.existsSync(currentPath)
        ? new SQL.Database(fs.readFileSync(currentPath))
        : new SQL.Database();
      runMigrations(db);
      persist(db);
      return db;
    })();
  }
  return dbPromise;
}

function persist(db: Database) {
  fs.writeFileSync(dbPath(), Buffer.from(db.export()));
}

function owns(row: Record<string, unknown>, ownerId?: string | null): boolean {
  if (!ownerId) return true;
  const rowOwner = row.owner_id ? String(row.owner_id) : null;
  return !rowOwner || rowOwner === ownerId;
}

export async function listSavedPlans(ownerId?: string | null): Promise<SavedPlan[]> {
  const db = await getDb();
  const result = db.exec("SELECT * FROM saved_plans ORDER BY updated_at DESC");
  if (!result[0]) return [];

  const cols = result[0].columns;
  const plans: SavedPlan[] = [];
  for (const values of result[0].values) {
    const row: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      row[col] = values[i];
    });
    if (!owns(row, ownerId)) continue;
    const crops = JSON.parse(String(row.crops_json)) as string[];
    const schedule = await scheduleForPlan(
      String(row.zip),
      String(row.zone),
      crops,
      String(row.risk_profile) as RiskProfile,
    );
    plans.push(rowToPlan(row, schedule));
  }
  return plans;
}

export async function getSavedPlan(
  id: string,
  ownerId?: string | null,
): Promise<SavedPlan | null> {
  const db = await getDb();
  const stmt = db.prepare("SELECT * FROM saved_plans WHERE id = ?");
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  if (!owns(row, ownerId)) return null;
  const crops = JSON.parse(String(row.crops_json)) as string[];
  const schedule = await scheduleForPlan(
    String(row.zip),
    String(row.zone),
    crops,
    String(row.risk_profile) as RiskProfile,
  );
  return rowToPlan(row, schedule);
}

export async function createSavedPlan(input: SavedPlanInput): Promise<SavedPlan> {
  const { zip, zone } = await resolveLocation(input.zip);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const riskProfile = input.riskProfile ?? "balanced";
  const climateDataVersion = getCurrentClimateDataVersion();
  const climateSnapshotId = climateSnapshotForZip(zip) ?? climateDataVersion;
  const schedule = await scheduleForPlan(zip, zone, input.crops, riskProfile);
  const lastFrostDate = schedule.lastFrostDate.toISOString();
  const ownerId = input.ownerId ?? null;

  const db = await getDb();
  db.run(
    `INSERT INTO saved_plans (id, name, zip, zone, crops_json, risk_profile, climate_data_version, climate_snapshot_id, owner_id, last_frost_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      zip,
      zone,
      JSON.stringify(input.crops),
      riskProfile,
      climateDataVersion,
      climateSnapshotId,
      ownerId,
      lastFrostDate,
      now,
      now,
    ],
  );
  persist(db);

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
  const existing = await getSavedPlan(id, ownerId);
  if (!existing) return null;

  const name = patch.name ?? existing.name;
  const crops = patch.crops ?? existing.crops;
  const riskProfile = patch.riskProfile ?? existing.riskProfile;
  const zip = patch.zip ?? existing.zip;
  const { zone } = await resolveLocation(zip);
  const now = new Date().toISOString();
  const climateDataVersion = getCurrentClimateDataVersion();
  const climateSnapshotId = climateSnapshotForZip(zip) ?? climateDataVersion;
  const schedule = await scheduleForPlan(zip, zone, crops, riskProfile);
  const lastFrostDate = schedule.lastFrostDate.toISOString();

  const db = await getDb();
  db.run(
    `UPDATE saved_plans
     SET name = ?, zip = ?, zone = ?, crops_json = ?, risk_profile = ?,
         climate_data_version = ?, climate_snapshot_id = ?, last_frost_date = ?, updated_at = ?
     WHERE id = ?`,
    [
      name,
      zip,
      zone,
      JSON.stringify(crops),
      riskProfile,
      climateDataVersion,
      climateSnapshotId,
      lastFrostDate,
      now,
      id,
    ],
  );
  persist(db);

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
  const existing = await getSavedPlan(id, ownerId);
  if (!existing) return false;
  const db = await getDb();
  db.run("DELETE FROM saved_plans WHERE id = ?", [id]);
  persist(db);
  return true;
}
