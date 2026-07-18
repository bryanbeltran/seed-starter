import fs from "fs";
import path from "path";

const UA =
  "seed-starter-catalog-etl/1.0 (+https://github.com/seed-starter; research)";

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchText(url, { delayMs = 150, retries = 3 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html,application/xml,*/*" },
      });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const text = await res.text();
      if (delayMs) await sleep(delayMs);
      return text;
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(1000 * (i + 1));
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
  if (!opts.refresh && fs.existsSync(file)) {
    return fs.readFileSync(file, "utf8");
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = await fetchText(url, opts);
  fs.writeFileSync(file, text);
  return text;
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
