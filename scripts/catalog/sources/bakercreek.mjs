import { cachedFetch, mapConcurrent, parseSitemapLocs } from "../lib/http.mjs";
import { isEdibleUrl, parseDays } from "../lib/merge.mjs";

const SITEMAP = "https://www.rareseeds.com/sitemap.xml";
const STORE = "https://www.rareseeds.com";
const PRODUCT_SITEMAP = /\/sitemap_products_\d+\.xml(?:\?|$)/;

export const meta = {
  id: "bakercreek",
  name: "Baker Creek Heirloom Seeds",
  url: "https://www.rareseeds.com",
  license: "public-web-citation",
};

async function listSitemapUrls(root) {
  const xml = await cachedFetch(root, "bakercreek", "sitemap.xml", SITEMAP, {
    refresh: true,
  });
  return parseSitemapLocs(xml).map((url) => url.replaceAll("&amp;", "&"));
}

export async function listCategoryUrls(root) {
  const urls = await listSitemapUrls(root);
  return [...new Set(urls.filter((url) => url.includes("/vegetable-seeds/")))];
}

export async function listUrls(root, { limit = Infinity } = {}) {
  const sitemapUrls = await listSitemapUrls(root);
  const productSitemaps = sitemapUrls.filter((url) => PRODUCT_SITEMAP.test(url));
  if (productSitemaps.length) {
    const urls = new Set();
    for (const [index, sitemap] of productSitemaps.entries()) {
      const xml = await cachedFetch(root, "bakercreek", `sitemap-products-${index}.xml`, sitemap, {
        refresh: true,
      });
      for (const url of parseSitemapLocs(xml).map((value) => value.replaceAll("&amp;", "&"))) {
        if (!isEdibleUrl(url)) continue;
        urls.add(url);
        if (urls.size >= limit) return [...urls];
      }
    }
    return [...urls];
  }

  const cats = sitemapUrls.filter((url) => url.includes("/vegetable-seeds/"));
  const urls = new Set();
  for (const cat of cats) {
    const key = cat.replace(/https?:\/\//, "");
    const html = await cachedFetch(root, "bakercreek", `cat-${key}`, cat, {
      delayMs: 200,
      refresh: true,
    });
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

export async function fetchRecord(root, url, { refresh = false } = {}) {
  const key = url.replace(/https?:\/\//, "");
  const html = await cachedFetch(root, "bakercreek", key, url, {
    delayMs: 150,
    refresh,
  });
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
      return await fetchRecord(root, url, opts);
    } catch (err) {
      opts.onFetchError?.(url, err);
      console.warn(`bakercreek skip ${url}: ${err.message}`);
      return null;
    }
  }, { concurrency: 8 });
  return rows.filter(Boolean);
}
