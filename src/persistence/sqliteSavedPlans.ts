import fs from "fs";
import path from "path";
import initSqlJs, { type Database } from "sql.js";
import { getCurrentClimateDataVersion } from "@/climate";
import type { GardenSeason, RiskProfile } from "@/planning";
import { resolveLocation } from "@/lib/resolveLocation";
import {
  canReadPlan,
  canWritePlan,
  climateSnapshotForZip,
  parseVarietiesJson,
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
  "005_saved_plans_season.sql",
  "006_saved_plans_varieties.sql",
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
  if (!hasColumn(db, "saved_plans", "season")) {
    db.run(
      "ALTER TABLE saved_plans ADD COLUMN season TEXT NOT NULL DEFAULT 'spring'",
    );
  }
  if (!hasColumn(db, "saved_plans", "varieties_json")) {
    db.run("ALTER TABLE saved_plans ADD COLUMN varieties_json TEXT");
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

function rowOwnerId(row: Record<string, unknown>): string | null {
  return row.owner_id ? String(row.owner_id) : null;
}

async function fetchRow(id: string): Promise<Record<string, unknown> | null> {
  const db = await getDb();
  const stmt = db.prepare("SELECT * FROM saved_plans WHERE id = ?");
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  return row;
}

async function planFromRow(row: Record<string, unknown>): Promise<SavedPlan> {
  const crops = JSON.parse(String(row.crops_json)) as string[];
  const varieties = parseVarietiesJson(row.varieties_json);
  const season = (row.season ? String(row.season) : "spring") as GardenSeason;
  const schedule = await scheduleForPlan(
    String(row.zip),
    String(row.zone),
    crops,
    String(row.risk_profile) as RiskProfile,
    season,
    varieties,
  );
  return rowToPlan(row, schedule);
}

export async function listSavedPlans(ownerId?: string | null): Promise<SavedPlan[]> {
  const db = await getDb();
  const plans: SavedPlan[] = [];

  if (ownerId) {
    const stmt = db.prepare(
      "SELECT * FROM saved_plans WHERE owner_id = ? OR owner_id IS NULL ORDER BY updated_at DESC",
    );
    stmt.bind([ownerId]);
    while (stmt.step()) {
      plans.push(await planFromRow(stmt.getAsObject() as Record<string, unknown>));
    }
    stmt.free();
    return plans;
  }

  const result = db.exec("SELECT * FROM saved_plans ORDER BY updated_at DESC");
  if (!result[0]) return [];
  const cols = result[0].columns;
  for (const values of result[0].values) {
    const row: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      row[col] = values[i];
    });
    plans.push(await planFromRow(row));
  }
  return plans;
}

export async function getSavedPlan(
  id: string,
  ownerId?: string | null,
): Promise<SavedPlan | null> {
  const row = await fetchRow(id);
  if (!row || !canReadPlan(rowOwnerId(row), ownerId)) return null;
  return planFromRow(row);
}

export async function createSavedPlan(input: SavedPlanInput): Promise<SavedPlan> {
  const { zip, zone } = await resolveLocation(input.zip);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const riskProfile = input.riskProfile ?? "balanced";
  const season = input.season ?? "spring";
  const varieties = input.varieties ?? {};
  const varietiesJson = JSON.stringify(varieties);
  const climateDataVersion = getCurrentClimateDataVersion();
  const climateSnapshotId = climateSnapshotForZip(zip) ?? climateDataVersion;
  const schedule = await scheduleForPlan(
    zip,
    zone,
    input.crops,
    riskProfile,
    season,
    varieties,
  );
  const lastFrostDate = schedule.lastFrostDate.toISOString();
  const ownerId = input.ownerId ?? null;

  const db = await getDb();
  db.run(
    `INSERT INTO saved_plans (id, name, zip, zone, crops_json, varieties_json, risk_profile, season, climate_data_version, climate_snapshot_id, owner_id, last_frost_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      zip,
      zone,
      JSON.stringify(input.crops),
      varietiesJson,
      riskProfile,
      season,
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
      varieties_json: varietiesJson,
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
  const row = await fetchRow(id);
  if (!row || !canWritePlan(rowOwnerId(row), ownerId)) return null;
  const existing = await planFromRow(row);

  const name = patch.name ?? existing.name;
  const crops = patch.crops ?? existing.crops;
  const varieties = patch.varieties ?? existing.varieties;
  const varietiesJson = JSON.stringify(varieties);
  const riskProfile = patch.riskProfile ?? existing.riskProfile;
  const season = patch.season ?? existing.season;
  const zip = patch.zip ?? existing.zip;
  const { zone } = await resolveLocation(zip);
  const now = new Date().toISOString();
  const climateDataVersion = getCurrentClimateDataVersion();
  const climateSnapshotId = climateSnapshotForZip(zip) ?? climateDataVersion;
  const schedule = await scheduleForPlan(
    zip,
    zone,
    crops,
    riskProfile,
    season,
    varieties,
  );
  const lastFrostDate = schedule.lastFrostDate.toISOString();

  const db = await getDb();
  db.run(
    `UPDATE saved_plans
     SET name = ?, zip = ?, zone = ?, crops_json = ?, varieties_json = ?, risk_profile = ?, season = ?,
         climate_data_version = ?, climate_snapshot_id = ?, last_frost_date = ?, updated_at = ?
     WHERE id = ?`,
    [
      name,
      zip,
      zone,
      JSON.stringify(crops),
      varietiesJson,
      riskProfile,
      season,
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
      varieties_json: varietiesJson,
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
  const row = await fetchRow(id);
  if (!row || !canWritePlan(rowOwnerId(row), ownerId)) return false;
  const db = await getDb();
  db.run("DELETE FROM saved_plans WHERE id = ?", [id]);
  persist(db);
  return true;
}
