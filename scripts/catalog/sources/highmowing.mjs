import { cachedFetch, parseSitemapLocs, mapConcurrent } from "../lib/http.mjs";
import { isEdibleUrl, parseDays } from "../lib/merge.mjs";

const SITEMAP = "https://www.highmowingseeds.com/sitemap.xml";

export const meta = {
  id: "highmowing",
  name: "High Mowing Organic Seeds",
  url: "https://www.highmowingseeds.com",
  license: "public-web-citation",
};

const VARIANT_SUFFIX = /-(?:[a-d]|m\d+)\.html$/;

export async function listUrls(root, { limit = Infinity } = {}) {
  const xml = await cachedFetch(root, "highmowing", "sitemap.xml", SITEMAP);
  const seen = new Set();
  const urls = [];
  for (const url of parseSitemapLocs(xml)) {
    if (!url.includes("organic-non-gmo-") || !url.endsWith(".html")) continue;
    if (url.includes("/vegetables/")) continue;
    if (/-seed\.html$/.test(url)) continue;
    if (VARIANT_SUFFIX.test(url)) continue;
    if (!isEdibleUrl(url)) continue;
    const base = url.replace(VARIANT_SUFFIX, ".html");
    if (seen.has(base)) continue;
    seen.add(base);
    urls.push(url);
    if (urls.length >= limit) break;
  }
  return urls;
}

export async function fetchRecord(root, url) {
  const key = url.replace(/https?:\/\//, "");
  const html = await cachedFetch(root, "highmowing", key, url);
  const name = html.match(/<span[^>]*class="[^"]*base[^"]*"[^>]*>([^<]+)/)?.[1]?.trim()
    ?? html.match(/<h1[^>]*>([^<]+)/)?.[1]?.trim();
  if (!name) return null;

  const dtm = html.match(/<p class="days-to-maturity"[^>]*>[\s\S]*?(\d{2,3})\s*days/i);
  const daysToHarvest = dtm ? parseDays(dtm[0]) : undefined;

  const slug = url.split("/").pop().replace(".html", "");
  const cropPart = slug.replace(/^organic-non-gmo-/, "").replace(/-[a-z0-9]+$/i, "");
  const cropCategory = cropPart.split("-")[0] ?? "vegetable";

  return {
    source: meta.id,
    sourceUrl: url,
    name,
    cropCategory,
    daysToHarvest,
    confidence: daysToHarvest ? "high" : "medium",
  };
}

export async function collect(root, opts = {}) {
  const urls = await listUrls(root, opts);
  const rows = await mapConcurrent(urls, async (url) => {
    try {
      return await fetchRecord(root, url);
    } catch (err) {
      console.warn(`highmowing skip ${url}: ${err.message}`);
      return null;
    }
  }, { concurrency: 10 });
  return rows.filter(Boolean);
}
