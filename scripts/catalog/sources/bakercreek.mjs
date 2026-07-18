import { cachedFetch, mapConcurrent } from "../lib/http.mjs";
import { isEdibleUrl, parseDays } from "../lib/merge.mjs";

const SITEMAP = "https://www.rareseeds.com/media/sitemap.xml";
const STORE = "https://www.rareseeds.com";

export const meta = {
  id: "bakercreek",
  name: "Baker Creek Heirloom Seeds",
  url: "https://www.rareseeds.com",
  license: "public-web-citation",
};

export async function listCategoryUrls(root) {
  const xml = await cachedFetch(root, "bakercreek", "sitemap.xml", SITEMAP);
  const cats = [...xml.matchAll(/<loc>([^<]*\/vegetable-seeds\/[^<]+)<\/loc>/g)].map((m) => m[1]);
  return [...new Set(cats)];
}

export async function listUrls(root, { limit = Infinity } = {}) {
  const cats = await listCategoryUrls(root);
  const urls = new Set();
  for (const cat of cats) {
    const key = cat.replace(/https?:\/\//, "");
    const html = await cachedFetch(root, "bakercreek", `cat-${key}`, cat, { delayMs: 200 });
    for (const m of html.matchAll(/href="(\/[^"]+\.html)"/g)) {
      const path = m[1];
      if (!path.includes("-seeds/") && !path.match(/\/[a-z0-9-]+\.html$/)) continue;
      const u = `${STORE}${path}`;
      if (!isEdibleUrl(u) || path.includes("store/")) continue;
      urls.add(u);
      if (urls.size >= limit) return [...urls];
    }
    for (const m of html.matchAll(/href="(https:\/\/www\.rareseeds\.com\/[^"]+\.html)"/g)) {
      urls.add(m[1]);
      if (urls.size >= limit) return [...urls];
    }
  }
  return [...urls];
}

export async function fetchRecord(root, url) {
  const key = url.replace(/https?:\/\//, "");
  const html = await cachedFetch(root, "bakercreek", key, url, { delayMs: 150 });
  const name = html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>([^<]+)/)?.[1]?.trim()
    ?? html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/)?.[1]?.trim();
  if (!name) return null;

  const daysToHarvest =
    parseDays(html.match(/Days to (?:Maturity|Harvest)[^<]{0,40}/i)?.[0]) ??
    parseDays(html.match(/(\d{2,3})\s*days/i)?.[0]);

  const parts = url.split("/");
  const cropCategory = parts[parts.length - 2]?.replace(/-seeds$/, "") ?? "vegetable";

  return {
    source: meta.id,
    sourceUrl: url,
    name: name.replace(/\s+Seeds?$/i, "").trim(),
    cropCategory,
    daysToHarvest,
    confidence: daysToHarvest ? "medium" : "low",
  };
}

export async function collect(root, opts = {}) {
  const urls = await listUrls(root, opts);
  const rows = await mapConcurrent(urls, async (url) => {
    try {
      return await fetchRecord(root, url);
    } catch (err) {
      console.warn(`bakercreek skip ${url}: ${err.message}`);
      return null;
    }
  }, { concurrency: 8 });
  return rows.filter(Boolean);
}
