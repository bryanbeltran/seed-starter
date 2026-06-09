import fs from "fs";
import path from "path";
import initSqlJs, { type Database } from "sql.js";
import type { RiskProfile, Schedule } from "@/planning";
import { buildSchedule } from "@/planning";
import { resolveLocation } from "@/lib/resolveLocation";
import { serializeSchedule } from "@/lib/serializeSchedule";

export type SavedPlanInput = {
  name: string;
  zip: string;
  crops: string[];
  riskProfile?: RiskProfile;
};

export type SavedPlan = {
  id: string;
  name: string;
  zip: string;
  zone: string;
  crops: string[];
  riskProfile: RiskProfile;
  createdAt: string;
  updatedAt: string;
  schedule: ReturnType<typeof serializeSchedule>;
};

const MIGRATION_PATH = path.join(
  process.cwd(),
  "db/migrations/001_saved_plans.sql",
);

function dbDir() {
  return process.env.SEEDSTARTER_DB_DIR ?? path.join(process.cwd(), ".seedstarter");
}

function dbPath() {
  return path.join(dbDir(), "seedstarter.sqlite");
}

let dbPromise: Promise<Database> | null = null;
let dbPromisePath: string | null = null;

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
      const migration = fs.readFileSync(MIGRATION_PATH, "utf8");
      db.run(migration);
      persist(db);
      return db;
    })();
  }
  return dbPromise;
}

function persist(db: Database) {
  const data = db.export();
  fs.writeFileSync(dbPath(), Buffer.from(data));
}

function rowToPlan(
  row: Record<string, unknown>,
  schedule: Schedule,
): SavedPlan {
  return {
    id: String(row.id),
    name: String(row.name),
    zip: String(row.zip),
    zone: String(row.zone),
    crops: JSON.parse(String(row.crops_json)) as string[],
    riskProfile: String(row.risk_profile) as RiskProfile,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    schedule: serializeSchedule(schedule),
  };
}

async function scheduleForPlan(
  zip: string,
  zone: string,
  crops: string[],
  riskProfile: RiskProfile,
): Promise<Schedule> {
  return buildSchedule({
    zone,
    zip,
    crops,
    riskProfile,
  });
}

export async function listSavedPlans(): Promise<SavedPlan[]> {
  const db = await getDb();
  const result = db.exec(
    "SELECT * FROM saved_plans ORDER BY updated_at DESC",
  );
  if (!result[0]) return [];

  const cols = result[0].columns;
  const plans: SavedPlan[] = [];
  for (const values of result[0].values) {
    const row: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      row[col] = values[i];
    });
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

export async function getSavedPlan(id: string): Promise<SavedPlan | null> {
  const db = await getDb();
  const stmt = db.prepare("SELECT * FROM saved_plans WHERE id = ?");
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  const crops = JSON.parse(String(row.crops_json)) as string[];
  const schedule = await scheduleForPlan(
    String(row.zip),
    String(row.zone),
    crops,
    String(row.risk_profile) as RiskProfile,
  );
  return rowToPlan(row, schedule);
}

export async function createSavedPlan(
  input: SavedPlanInput,
): Promise<SavedPlan> {
  const { zip, zone } = await resolveLocation(input.zip);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const riskProfile = input.riskProfile ?? "balanced";

  const db = await getDb();
  db.run(
    `INSERT INTO saved_plans (id, name, zip, zone, crops_json, risk_profile, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      zip,
      zone,
      JSON.stringify(input.crops),
      riskProfile,
      now,
      now,
    ],
  );
  persist(db);

  const schedule = await scheduleForPlan(
    zip,
    zone,
    input.crops,
    riskProfile,
  );
  return rowToPlan(
    {
      id,
      name: input.name,
      zip,
      zone,
      crops_json: JSON.stringify(input.crops),
      risk_profile: riskProfile,
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

  const db = await getDb();
  db.run(
    `UPDATE saved_plans
     SET name = ?, zip = ?, zone = ?, crops_json = ?, risk_profile = ?, updated_at = ?
     WHERE id = ?`,
    [name, zip, zone, JSON.stringify(crops), riskProfile, now, id],
  );
  persist(db);

  const schedule = await scheduleForPlan(zip, zone, crops, riskProfile);
  return rowToPlan(
    {
      id,
      name,
      zip,
      zone,
      crops_json: JSON.stringify(crops),
      risk_profile: riskProfile,
      created_at: existing.createdAt,
      updated_at: now,
    },
    schedule,
  );
}

export async function deleteSavedPlan(id: string): Promise<boolean> {
  const existing = await getSavedPlan(id);
  if (!existing) return false;
  const db = await getDb();
  db.run("DELETE FROM saved_plans WHERE id = ?", [id]);
  persist(db);
  return true;
}
