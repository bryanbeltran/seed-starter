import fs from "fs";
import path from "path";

const UA =
  "seed-starter-catalog-etl/1.0 (+https://github.com/seed-starter; research)";
const DEFAULT_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRY_DELAY_MS = 120_000;

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function retryAfterMs(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function retryDelay(attempt, serverDelay = null) {
  if (serverDelay != null && serverDelay > MAX_RETRY_DELAY_MS) return null;
  const backoff = Math.min(30_000, 1_000 * 2 ** attempt);
  return Math.max(serverDelay ?? backoff, 250) + Math.floor(Math.random() * 500);
}

export async function fetchText(
  url,
  { delayMs = 150, retries = 3, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html,application/xml,*/*" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const error = new Error(`${res.status} ${url}`);
        error.status = res.status;
        error.retryAfterMs = retryAfterMs(res.headers.get("retry-after"));
        throw error;
      }
      const text = await res.text();
      if (delayMs) await sleep(delayMs);
      return text;
    } catch (err) {
      const retryable = !err.status || isRetryableStatus(err.status);
      const attemptLimit = err.status ? retries : Math.min(retries, 2);
      if (!retryable || i + 1 >= attemptLimit) throw err;
      const waitMs = retryDelay(i, err.retryAfterMs);
      if (waitMs == null) throw err;
      await sleep(waitMs);
    }
  }
}

export async function fetchJson(url, opts) {
  const text = await fetchText(url, opts);
  return JSON.parse(text);
}

export function cachePath(root, source, key) {
  const safe = key.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
  return path.join(root, "data/catalog/.cache", source, safe);
}

export async function cachedFetch(root, source, key, url, opts = {}) {
  const file = cachePath(root, source, key);
  const hasCache = fs.existsSync(file);
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_CACHE_MAX_AGE_MS;
  if (hasCache) {
    const ageMs = Date.now() - fs.statSync(file).mtimeMs;
    if (!opts.refresh && ageMs <= maxAgeMs) {
      return fs.readFileSync(file, "utf8");
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    const text = await fetchText(url, opts);
    fs.writeFileSync(file, text);
    return text;
  } catch (err) {
    if (!hasCache || opts.staleIfError === false) throw err;
    console.warn(`${source} using stale cache for ${url}: ${err.message}`);
    return fs.readFileSync(file, "utf8");
  }
}

export function parseSitemapLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

export async function mapConcurrent(items, fn, { concurrency = 8 } = {}) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
