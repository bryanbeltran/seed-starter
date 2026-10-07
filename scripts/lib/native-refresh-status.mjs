import fs from "node:fs";
import path from "node:path";

const SOURCE_IDS = ["usda-plants", "bonap-napa", "npin"];

function lastDate(values) {
  return values.filter(Boolean).sort().at(-1) ?? null;
}

export function createNativeRefreshStatus({
  startedAt,
  rangeEvidence,
  sourceIngestion,
}) {
  const usdaLastSuccess = lastDate(
    (rangeEvidence?.records ?? [])
      .filter((record) => record.sourceId === "usda-plants")
      .map((record) => record.retrievedAt),
  );
  return {
    version: "1",
    startedAt,
    completedAt: null,
    status: "running",
    lastGoodSnapshotRetrievedAt: sourceIngestion?.retrievedAt ?? null,
    failures: [],
    sources: {
      "usda-plants": { status: "not_started", lastSuccessAt: usdaLastSuccess },
      "bonap-napa": {
        status: "not_started",
        lastSuccessAt: sourceIngestion?.bonap?.retrievedAt ?? null,
      },
      npin: {
        status: "not_started",
        lastSuccessAt: sourceIngestion?.npin?.retrievedAt ?? null,
      },
    },
  };
}

export function persistNativeRefreshStatus(filePath, status) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const stagedPath = `${filePath}.staged`;
  fs.writeFileSync(stagedPath, `${JSON.stringify(status, null, 2)}\n`);
  fs.renameSync(stagedPath, filePath);
}

export function failNativeRefreshStatus({
  filePath,
  status,
  error,
  stage,
  completedAt,
}) {
  const sourceId = SOURCE_IDS.includes(error?.sourceId)
    ? error.sourceId
    : SOURCE_IDS.includes(stage)
      ? stage
      : "refresh";
  status.status = "failed";
  status.completedAt = completedAt;
  if (status.sources[sourceId]) status.sources[sourceId].status = "failed";
  for (const source of Object.values(status.sources)) {
    if (source.status === "staged") source.status = "not_published";
  }
  status.failures.push({
    sourceId,
    stage,
    message: error instanceof Error ? error.message : String(error),
  });
  persistNativeRefreshStatus(filePath, status);
  return status;
}
