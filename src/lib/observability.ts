export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, string | number | boolean | undefined | null>;

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function log(level: LogLevel, message: string, fields: LogFields = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  if (level === "error" && process.env.SENTRY_DSN) {
    void reportToSentry(message, fields).catch(() => undefined);
  }
}

async function reportToSentry(message: string, fields: LogFields) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const match = dsn.match(
    /^https:\/\/([^@]+)@([^/]+)\/(.+)$/,
  );
  if (!match) return;
  const [, key, host, projectId] = match;
  const url = `https://${host}/api/${projectId}/store/`;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${key}`,
    },
    body: JSON.stringify({
      message,
      level: "error",
      platform: "node",
      timestamp: Date.now() / 1000,
      tags: Object.fromEntries(
        Object.entries(fields)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)]),
      ),
    }),
  });
}

export function withRequestId(headers: Headers, requestId: string): Headers {
  const next = new Headers(headers);
  next.set("x-request-id", requestId);
  return next;
}
