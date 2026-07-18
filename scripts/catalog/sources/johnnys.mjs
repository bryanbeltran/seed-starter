import { cachedFetch, fetchText, parseSitemapLocs, mapConcurrent } from "../lib/http.mjs";
import { isEdibleUrl, parseDays } from "../lib/merge.mjs";

const SITEMAP = "https://www.johnnyseeds.com/sitemap_0-product.xml";

export const meta = {
  id: "johnnys",
  name: "Johnny's Selected Seeds",
  url: "https://www.johnnyseeds.com",
  license: "public-web-citation",
};

export async function listUrls(root, { limit = Infinity } = {}) {
  const xml = await cachedFetch(root, "johnnys", "sitemap-products.xml", SITEMAP);
  return parseSitemapLocs(xml)
    .filter((u) => isEdibleUrl(u) && u.endsWith(".html"))
    .slice(0, limit);
}

export async function fetchRecord(root, url) {
  const key = url.replace(/https?:\/\//, "");
  const html = await cachedFetch(root, "johnnys", key, url);
  const name = html.match(/<h1[^>]*class="[^"]*product-name[^"]*"[^>]*>([^<]+)/)?.[1]?.trim();
  if (!name) return null;

  const crumbs = [...html.matchAll(/"name":\s*"([^"]+)"[^}]*"@id":\s*"https:\/\/www\.johnnyseeds\.com\/vegetables/g)]
    .map((m) => m[1]);
  const pathCrop = url.match(/\/vegetables\/([a-z0-9-]+)/i)?.[1];
  const cropCategory = pathCrop ?? crumbs.at(-1) ?? "vegetable";

  let daysToHarvest;
  const facts = [...html.matchAll(
    /<h3[^>]*title="([^"]+)"[^>]*>[\s\S]*?<dd class="c-facts__definition">\s*<h4>([^<]+)/g,
  )];
  for (const [, term, val] of facts) {
    if (/days to maturity/i.test(term)) daysToHarvest = parseDays(val);
  }

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
      console.warn(`johnnys skip ${url}: ${err.message}`);
      return null;
    }
  }, { concurrency: 10 });
  return rows.filter(Boolean);
}
