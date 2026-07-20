#!/usr/bin/env node
/** Prod/local smoke: health + schedule + openapi. */
const base = (process.env.SMOKE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const strict =
  process.env.SMOKE_STRICT === "1" ||
  process.env.SMOKE_STRICT === "true" ||
  /seed-starter\.vercel\.app$/i.test(new URL(base).hostname);

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
  if (strict) {
    if (body.persistence !== "postgres") {
      throw new Error(`persistence=${body.persistence} (want postgres)`);
    }
    if (body.auth !== "owner-cookie") {
      throw new Error(`auth=${body.auth} (want owner-cookie)`);
    }
  }
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

await check("POST /api/schedules fall", async () => {
  const res = await fetch(`${base}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zip: "55423",
      seeds: ["lettuce"],
      season: "fall",
      riskProfile: "balanced",
    }),
  });
  if (!res.ok) throw new Error(`status ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (body.season !== "fall") throw new Error(`season=${body.season}`);
  if (!body.tasks?.some((t) => t.type === "indoor_sow" || t.type === "fall_sow")) {
    throw new Error("missing fall sow tasks");
  }
});

await check("POST /api/schedules fall rejects tomato", async () => {
  const res = await fetch(`${base}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zip: "55423",
      seeds: ["tomato"],
      season: "fall",
    }),
  });
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
});

await check("POST /api/schedules summer", async () => {
  const res = await fetch(`${base}/api/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zip: "55423",
      seeds: ["beans"],
      season: "summer",
      riskProfile: "balanced",
    }),
  });
  if (!res.ok) throw new Error(`status ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (body.season !== "summer") throw new Error(`season=${body.season}`);
  if (!body.tasks?.some((t) => t.type === "succession_sow")) {
    throw new Error("missing succession_sow");
  }
});

await check("GET /api/natives", async () => {
  const res = await fetch(`${base}/api/natives?zip=55423`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const body = await res.json();
  if (body.ecoregion?.id !== "51") throw new Error(`ecoregion=${body.ecoregion?.id}`);
  if (!body.county?.name) throw new Error("missing county overlay");
});

if (process.exitCode) process.exit(process.exitCode);
console.log(`Smoke OK against ${base}${strict ? " (strict)" : ""}`);
