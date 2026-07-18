import { cropDefaults, springSeason } from "./cropDefaults.mjs";
import { resolveCropRecord } from "./cropResolve.mjs";
import { displayName, slugify, varietyId } from "./slug.mjs";

const EDIBLE_PREFIXES = [
  "/vegetables/",
  "/herbs/",
  "/fruits/",
  "/organic-non-gmo-",
  "/products/",
  "/seeds/",
  "/store/plants-seeds/",
];

const EXCLUDE_PATTERNS = [
  /flower/i,
  /cover-crop/i,
  /supplies/i,
  /apparel/i,
  /gift/i,
  /tool/i,
  /fertiliz/i,
  /soil/i,
  /mulch/i,
  /trap/i,
  /netting/i,
  /label/i,
  /book/i,
  /catalog/i,
  /pollination-guard/i,
  /nematode/i,
  /grafting-tape/i,
  /cloche/i,
  /seed-to-seed/i,
  /web-only/i,
  /collections\.html/i,
  /new-for-/i,
];

export function isEdibleUrl(url) {
  if (EXCLUDE_PATTERNS.some((p) => p.test(url))) return false;
  return EDIBLE_PREFIXES.some((p) => url.includes(p));
}

export function parseDays(text) {
  if (!text) return undefined;
  const m = String(text).match(/(\d{2,3})\s*(?:-\s*(\d{2,3}))?\s*days?/i);
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return Math.round((a + b) / 2);
}

/** @typedef {{ source: string, sourceUrl: string, name: string, cropCategory: string, daysToHarvest?: number, sku?: string, confidence: string, tags?: string[] }} RawSeed */

export function mergeRecords(records, { target = 2000 } = {}) {
  const byKey = new Map();
  let dropped = 0;
  for (const rec of records) {
    const cropId = resolveCropRecord(rec);
    if (!cropId) {
      dropped++;
      continue;
    }
    const vid = varietyId(rec.name, cropId);
    const key = `${cropId}::${slugify(rec.name)}`;
    const existing = byKey.get(key);
    if (!existing || score(rec) > score(existing)) {
      byKey.set(key, { ...rec, cropId, varietyId: vid });
    } else if (existing && rec.source !== existing.source) {
      existing.altSources = [...(existing.altSources ?? []), rec.source];
    }
  }

  let merged = [...byKey.values()];
  if (merged.length > target) merged = merged.slice(0, target);
  if (dropped) console.log(`  dropped ${dropped} unresolvable records`);
  return buildCatalog(merged);
}

function score(rec) {
  const conf = { high: 3, medium: 2, low: 1 };
  return (conf[rec.confidence] ?? 1) + (rec.daysToHarvest ? 1 : 0);
}

function buildCatalog(seeds) {
  const crops = {};
  for (const seed of seeds) {
    const { cropId } = seed;
    if (!crops[cropId]) {
      const defaults = cropDefaults(cropId);
      crops[cropId] = {
        id: cropId,
        name: displayName(cropId),
        category: inferCategoryFromCropId(cropId),
        family: inferFamily(cropId),
        ...defaults,
        seasons: { spring: springSeason(defaults) },
        source: "catalog-etl",
        confidence: "low",
        varieties: {},
      };
    }
    const crop = crops[cropId];
    let vid = seed.varietyId;
    if (crop.varieties[vid]) {
      vid = `${vid}-${seed.source}`;
    }
    crop.varieties[vid] = {
      id: vid,
      name: seed.name,
      daysToHarvest: seed.daysToHarvest ?? crop.daysToHarvest,
      source: seed.source,
      sourceUrl: seed.sourceUrl,
      confidence: seed.confidence,
      ...(seed.sku ? { sku: seed.sku } : {}),
    };
    if (seed.daysToHarvest) {
      crop.confidence = "medium";
    }
  }
  return { crops, varietyCount: seeds.length, cropCount: Object.keys(crops).length };
}

function inferCategoryFromCropId(cropId) {
  return CROP_CATEGORY[cropId] ?? "vegetable";
}

const CROP_CATEGORY = {
  basil: "herb", cilantro: "herb", parsley: "herb", dill: "herb",
  thyme: "herb", oregano: "herb", sage: "herb", mint: "herb", herb: "herb",
  ginger: "herb", turmeric: "herb",
  tomato: "fruit", pepper: "fruit", eggplant: "fruit", melon: "fruit",
  watermelon: "fruit", cantaloupe: "fruit", honeydew: "fruit",
  strawberry: "fruit", blueberry: "fruit", grape: "fruit",
  tomatillo: "fruit", "ground-cherry": "fruit",
  pumpkin: "fruit", "squash-summer": "fruit", "squash-winter": "fruit",
  cucumber: "fruit", gourd: "fruit", luffa: "fruit",
  grain: "grain", corn: "grain", amaranth: "grain", buckwheat: "grain",
  quinoa: "grain", flax: "grain",
  mushroom: "mushroom",
};

export { inferCategoryFromCropId };

function inferFamily(cropId) {
  const legumes = ["beans", "pea", "soybean"];
  const brassicas = ["broccoli", "kale", "cabbage", "cauliflower", "brussels-sprouts", "radish", "turnip", "asian-greens", "greens"];
  const solanaceae = ["tomato", "pepper", "eggplant"];
  const cucurbits = ["cucumber", "melon", "watermelon", "squash-summer", "squash-winter", "pumpkin"];
  if (legumes.includes(cropId)) return "legume";
  if (brassicas.includes(cropId)) return "brassica";
  if (solanaceae.includes(cropId)) return "solanaceae";
  if (cucurbits.includes(cropId)) return "cucurbit";
  if (cropId === "corn") return "grass";
  if (cropId === "basil" || cropId === "herb") return "lamiaceae";
  return "other";
}
