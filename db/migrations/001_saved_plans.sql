CREATE TABLE IF NOT EXISTS saved_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  zip TEXT NOT NULL,
  zone TEXT NOT NULL,
  crops_json TEXT NOT NULL,
  risk_profile TEXT NOT NULL DEFAULT 'balanced',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
