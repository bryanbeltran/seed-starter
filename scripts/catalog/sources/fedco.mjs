import { cachedFetch, mapConcurrent } from "../lib/http.mjs";
import { isEdibleUrl, parseDays } from "../lib/merge.mjs";

const INDEX = "https://fedcoseeds.com/seeds/";

export const meta = {
  id: "fedco",
  name: "Fedco Seeds",
  url: "https://fedcoseeds.com",
  license: "public-web-citation",
};

export async function listCategoryUrls(root) {
  const html = await cachedFetch(root, "fedco", "seeds-index.html", INDEX);
  const cats = [...html.matchAll(/href="(https:\/\/fedcoseeds\.com\/vegetables\/[^"]+)"/g)].map(
    (m) => m[1],
  );
  return [...new Set(cats)];
}

export async function listUrls(root, { limit = Infinity } = {}) {
  const cats = await listCategoryUrls(root);
  const urls = new Set();
  for (const cat of cats) {
    const key = cat.replace(/https?:\/\//, "");
    const html = await cachedFetch(root, "fedco", `cat-${key}`, cat, { delayMs: 200 });
    for (const m of html.matchAll(/href="(https:\/\/fedcoseeds\.com\/seeds\/[^"]+)"/g)) {
      const u = m[1];
      if (isEdibleUrl(u) && /-\d+$/.test(u)) urls.add(u);
      if (urls.size >= limit) return [...urls];
    }
  }
  return [...urls];
}

export async function fetchRecord(root, url) {
  const key = url.replace(/https?:\/\//, "");
  const html = await cachedFetch(root, "fedco", key, url, { delayMs: 150 });
  const title = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ").trim();
  if (!title) return null;

  const sub = html.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<[^>]+>([^<]+)/i)?.[1]?.trim();
  const name = title.split(/\s{2,}/)[0].trim();
  const slug = url.split("/").pop().replace(/-\d+$/, "");
  const cropCategory =
    slug.replace(/^[^-]+-/, "").replace(/-[^-]+$/, "") ||
    sub ||
    "vegetable";

  let daysToHarvest;
  const dtm = html.match(/Days to Maturity[\s\S]*?<dd[^>]*>\s*(\d{2,3})\s*days/i);
  if (dtm) daysToHarvest = Number(dtm[1]);

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
      console.warn(`fedco skip ${url}: ${err.message}`);
      return null;
    }
  }, { concurrency: 8 });
  return rows.filter(Boolean);
}
