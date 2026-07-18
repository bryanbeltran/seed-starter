#!/usr/bin/env node
/** Prod/local smoke: health + schedule + openapi. */
const base = (process.env.SMOKE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    console.log(`✓ ${name} (${Date.now() - started}ms)`);
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

await check("GET /api/health", async () => {
  const res = await fetch(`${base}/api/health`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const body = await res.json();
  if (body.status !== "ok") throw new Error("status not ok");
  if (!body.climate?.zipCount) throw new Error("missing climate.zipCount");
});

await check("GET /api/openapi", async () => {
  const res = await fetch(`${base}/api/openapi`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const body = await res.json();
  if (body.openapi !== "3.0.3") throw new Error("bad openapi version");
});

await check("POST /api/schedules", async () => {
  const res = await fetch(`${base}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zip: "55423", seeds: ["tomato"], riskProfile: "balanced" }),
  });
  if (!res.ok) throw new Error(`status ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (body.frostSource !== "climate") throw new Error(`frostSource=${body.frostSource}`);
  if (!body.climateConfidence) throw new Error("missing climateConfidence");
});

if (process.exitCode) process.exit(process.exitCode);
console.log(`Smoke OK against ${base}`);
