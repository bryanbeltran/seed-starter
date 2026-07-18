import { cachedFetch, parseSitemapLocs, mapConcurrent } from "../lib/http.mjs";
import { isEdibleUrl, parseDays } from "../lib/merge.mjs";

const SITEMAP =
  "https://territorialseed.com/sitemap_products_1.xml?from=1463036706915&to=9162347511982";

export const meta = {
  id: "territorial",
  name: "Territorial Seed Company",
  url: "https://territorialseed.com",
  license: "public-web-citation",
};

const SKIP = /pollination|nematode|wood-tray|seed-to-seed|cloche|grafting|book|tool|fertiliz|magic|dynamite/i;

export async function listUrls(root, { limit = Infinity } = {}) {
  const xml = await cachedFetch(root, "territorial", "sitemap-products.xml", SITEMAP);
  return parseSitemapLocs(xml)
    .filter((u) => u.includes("/products/") && !SKIP.test(u))
    .slice(0, limit);
}

export async function fetchRecord(root, url) {
  const handle = url.split("/products/")[1]?.replace(/\/$/, "");
  if (!handle) return null;
  const jsonUrl = `https://territorialseed.com/products/${handle}.js`;
  const key = `products-${handle}.js`;
  const raw = await cachedFetch(root, "territorial", key, jsonUrl, { delayMs: 120 });
  const product = JSON.parse(raw);
  if (!product?.title) return null;

  const tags = product.tags ?? [];
  if (!tags.some((t) => /^Class:SEEDS/i.test(t))) return null;
  if (tags.some((t) => /Class:HARDGOOD|FERTILIZER|SUPPLIES/i.test(t))) return null;

  const cropCategory = handle.split("-")[0] ?? "vegetable";

  const daysToHarvest =
    parseDays(product.description) ?? parseDays(product.body_html?.replace(/<[^>]+>/g, " "));

  return {
    source: meta.id,
    sourceUrl: url,
    name: product.title.replace(/\s+(TOMATO|BEAN|PEPPER|LETTUCE)$/i, "").trim(),
    cropCategory,
    daysToHarvest,
    confidence: daysToHarvest ? "high" : "medium",
    tags,
  };
}

export async function collect(root, opts = {}) {
  const urls = await listUrls(root, opts);
  const rows = await mapConcurrent(urls, async (url) => {
    try {
      return await fetchRecord(root, url);
    } catch (err) {
      console.warn(`territorial skip ${url}: ${err.message}`);
      return null;
    }
  }, { concurrency: 3, delayMs: 250 });
  return rows.filter(Boolean);
}
