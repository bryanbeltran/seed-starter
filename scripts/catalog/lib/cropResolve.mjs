import { cropIdFromCategory, slugify } from "./slug.mjs";

/** Canonical crop ids the catalog may contain */
export const KNOWN_CROP_IDS = new Set([
  "tomato", "pepper", "eggplant", "lettuce", "carrot", "broccoli", "kale", "cabbage",
  "cauliflower", "cucumber", "melon", "watermelon", "squash-summer", "squash-winter",
  "pumpkin", "corn", "beans", "pea", "beet", "radish", "spinach", "onion", "leek",
  "garlic", "basil", "asian-greens", "potato", "mushroom",
  "artichoke", "asparagus", "okra", "celery", "kohlrabi", "fennel", "turnip", "parsnip",
  "brussels-sprouts", "microgreens", "chard", "collards", "arugula", "cilantro",
  "parsley", "dill", "thyme", "oregano", "sage", "mint", "tomatillo", "ground-cherry",
  "sweet-potato", "rutabaga", "shallot", "scallion", "endive", "escarole", "cress",
  "mustard", "watercress", "sunflower", "amaranth", "buckwheat", "quinoa", "flax",
  "edamame", "soybean", "horseradish", "rhubarb", "strawberry", "blueberry", "grape",
  "ginger", "turmeric", "gourd", "luffa", "cantaloupe", "honeydew",
  "rosemary", "chamomile", "lemon-balm", "marjoram", "catnip", "lovage", "shiso",
  "dandelion", "stevia", "hyssop", "savory", "borage", "chervil", "rue", "angelica",
  "valerian", "cumin", "salad-burnet", "sorrel", "purslane", "orach",
]);

/** Retired catch-all ids — never assign */
export const BANNED_CROP_IDS = new Set(["herb", "greens", "grain"]);

const JUNK_TOKENS = new Set([
  "a", "an", "and", "de", "dry", "eco", "f1", "for", "gmo", "my", "non", "of",
  "op", "or", "red", "ss", "the", "type", "winter", "y", "seed", "seeds", "organic",
  "class", "green", "gold", "black", "white", "yellow", "purple", "pink", "blue",
  "new", "early", "late", "mini", "baby", "giant", "dwarf", "mixed", "mix", "blend",
  "specialty", "fresh", "market", "storage", "main", "crop", "colored", "standard",
  "slicing", "pickling", "shell", "snap", "snow", "bush", "pole", "roma", "heirloom",
]);

const VARIETY_HINTS = {
  astro: "arugula",
  bellezia: "arugula",
  esmee: "arugula",
  trophy: "arugula",
  uber: "arugula",
  vit: "mustard",
  tatsoi: "asian-greens",
  mizuna: "asian-greens",
  "joi-choi": "asian-greens",
  "mei-qing-choi": "asian-greens",
  "win-win-choi": "asian-greens",
  "li-ren-choi": "asian-greens",
  "tokyo-bekana": "asian-greens",
  shungiku: "asian-greens",
};

const NAME_HINTS = [
  [/winter squash|butternut|acorn squash|hubbard|honeyboat|delicata/i, "squash-winter"],
  [/summer squash|zucchini|pattypan/i, "squash-summer"],
  [/watermelon/i, "watermelon"],
  [/cantaloupe|muskmelon/i, "cantaloupe"],
  [/honeydew/i, "honeydew"],
  [/ground cherry/i, "ground-cherry"],
  [/tomatillo/i, "tomatillo"],
  [/sweet potato/i, "sweet-potato"],
  [/brussels sprout/i, "brussels-sprouts"],
  [/bok choy|pak choi|pac choi|tatsoi|mizuna|komatsuna|asian green|choi\b/i, "asian-greens"],
  [/swiss chard|chard/i, "chard"],
  [/collard/i, "collards"],
  [/snap pea|snow pea|shell pea|garden pea/i, "pea"],
  [/bush bean|pole bean|lima bean|fava bean|dry bean|shell bean|wax bean|yard.?long/i, "beans"],
  [/soybean|edamame/i, "soybean"],
  [/hot pepper|sweet pepper|bell pepper|cayenne|jalape|habanero|poblano/i, "pepper"],
  [/cherry tomato|grape tomato|paste tomato|beefsteak|roma tomato|tomato/i, "tomato"],
  [/lettuce|romaine|butterhead|bibb|oakleaf/i, "lettuce"],
  [/cucumber|gherkin/i, "cucumber"],
  [/broccoli|broccolini/i, "broccoli"],
  [/cauliflower/i, "cauliflower"],
  [/cabbage/i, "cabbage"],
  [/kale/i, "kale"],
  [/malabar spinach|spinach/i, "spinach"],
  [/carrot/i, "carrot"],
  [/beet/i, "beet"],
  [/radish/i, "radish"],
  [/turnip/i, "turnip"],
  [/parsnip/i, "parsnip"],
  [/rutabaga/i, "rutabaga"],
  [/onion/i, "onion"],
  [/shallot/i, "shallot"],
  [/scallion|bunching onion/i, "scallion"],
  [/leek/i, "leek"],
  [/garlic/i, "garlic"],
  [/sweet corn|popcorn|\bcorn\b/i, "corn"],
  [/pumpkin/i, "pumpkin"],
  [/eggplant|aubergine/i, "eggplant"],
  [/artichoke/i, "artichoke"],
  [/asparagus/i, "asparagus"],
  [/rosemary/i, "rosemary"],
  [/chamomile/i, "chamomile"],
  [/lemon balm/i, "lemon-balm"],
  [/marjoram/i, "marjoram"],
  [/catnip/i, "catnip"],
  [/lovage/i, "lovage"],
  [/shiso/i, "shiso"],
  [/dandelion/i, "dandelion"],
  [/stevia/i, "stevia"],
  [/hyssop/i, "hyssop"],
  [/summer savory|winter savory|\bsavory\b/i, "savory"],
  [/borage/i, "borage"],
  [/chervil/i, "chervil"],
  [/salad burnet/i, "salad-burnet"],
  [/\brue\b/i, "rue"],
  [/angelica/i, "angelica"],
  [/valerian/i, "valerian"],
  [/cumin/i, "cumin"],
  [/basil/i, "basil"],
  [/cilantro|coriander/i, "cilantro"],
  [/parsley/i, "parsley"],
  [/dill/i, "dill"],
  [/thyme/i, "thyme"],
  [/oregano/i, "oregano"],
  [/sage/i, "sage"],
  [/mint/i, "mint"],
  [/arugula|rocket/i, "arugula"],
  [/microgreen|mesclun|greens mix|salad mix/i, "microgreens"],
  [/sorrel/i, "sorrel"],
  [/purslane/i, "purslane"],
  [/orach/i, "orach"],
  [/watercress|upland cress/i, "watercress"],
  [/claytonia|miner.?s lettuce/i, "cress"],
  [/sunflower/i, "sunflower"],
  [/amaranth/i, "amaranth"],
  [/okra/i, "okra"],
  [/celery/i, "celery"],
  [/kohlrabi/i, "kohlrabi"],
  [/fennel/i, "fennel"],
  [/potato/i, "potato"],
  [/horseradish/i, "horseradish"],
  [/rhubarb/i, "rhubarb"],
  [/mustard/i, "mustard"],
  [/endive/i, "endive"],
  [/escarole/i, "escarole"],
  [/blueberry/i, "blueberry"],
  [/strawberry/i, "strawberry"],
  [/grape\b/i, "grape"],
  [/ginger/i, "ginger"],
  [/turmeric/i, "turmeric"],
  [/luffa/i, "luffa"],
  [/ornamental gourd|birdhouse|gourd/i, "gourd"],
  [/buckwheat/i, "buckwheat"],
  [/quinoa/i, "quinoa"],
  [/flax/i, "flax"],
  [/mushroom/i, "mushroom"],
  [/melon/i, "melon"],
];

export function isJunkToken(token) {
  return !token || JUNK_TOKENS.has(token) || token.length < 3;
}

export function isValidCropId(cropId) {
  if (!cropId || typeof cropId !== "string") return false;
  if (cropId.length < 3) return false;
  if (JUNK_TOKENS.has(cropId)) return false;
  if (BANNED_CROP_IDS.has(cropId)) return false;
  return KNOWN_CROP_IDS.has(cropId);
}

function inferFromVarietySlug(slug) {
  if (VARIETY_HINTS[slug]) return VARIETY_HINTS[slug];
  for (const [key, cropId] of Object.entries(VARIETY_HINTS)) {
    if (slug.includes(key)) return cropId;
  }
  return null;
}

export function inferCropFromName(name) {
  if (!name) return null;
  for (const [pattern, cropId] of NAME_HINTS) {
    if (pattern.test(name)) return cropId;
  }
  const slug = slugify(name);
  const fromVariety = inferFromVarietySlug(slug);
  if (fromVariety) return fromVariety;
  const sorted = [...KNOWN_CROP_IDS].sort((a, b) => b.length - a.length);
  for (const cropId of sorted) {
    if (slug.includes(cropId)) return cropId;
  }
  return null;
}

export function inferCropFromUrl(url) {
  if (!url) return null;
  let path;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }

  const section =
    path.match(/\/vegetables\/([a-z0-9-]+)/)?.[1] ??
    path.match(/\/herbs\/([a-z0-9-]+)/)?.[1] ??
    path.match(/\/fruits\/([a-z0-9-]+)/)?.[1];
  if (section) {
    const id = cropIdFromCategory(section);
    if (isValidCropId(id)) return id;
  }

  const slug = path.split("/").pop()?.replace(/\.html$/, "").replace(/-\d+$/, "") ?? "";
  const fromSlug = inferCropFromName(slug.replace(/-/g, " "));
  if (fromSlug) return fromSlug;

  return null;
}

export function isCollectionRecord(rec) {
  const text = `${rec.name} ${rec.cropCategory ?? ""}`;
  return /\b(collection|disk collection|seed collection|simplyherbs)\b/i.test(text);
}

export function isCoverCropRecord(rec) {
  const text = `${rec.name} ${rec.cropCategory ?? ""}`;
  return /\b(cover crop|field pea|vetch mix|rye\/hairy|peas\/oats|wheat|barley|\boats?\b|\brye\b|wheatgrass)\b/i.test(text);
}

/**
 * Resolve a raw seed record to a canonical crop id, or null to drop it.
 * Priority: product name > URL path > category alias.
 */
export function resolveCropRecord(rec) {
  if (isCollectionRecord(rec) || isCoverCropRecord(rec)) return null;

  const candidates = [
    inferCropFromName(rec.name),
    inferCropFromUrl(rec.sourceUrl),
    cropIdFromCategory(rec.cropCategory ?? ""),
    inferCropFromName(rec.cropCategory ?? ""),
  ];

  for (const id of candidates) {
    if (isValidCropId(id)) return id;
  }
  return null;
}

export function findJunkCrops(crops) {
  const errors = [];
  for (const [cropId, crop] of Object.entries(crops ?? {})) {
    if (!isValidCropId(cropId)) {
      errors.push(`junk crop id: ${cropId} (${crop.name})`);
    }
    if (BANNED_CROP_IDS.has(cropId)) {
      errors.push(`banned catch-all crop: ${cropId} (${crop.name})`);
    }
    if (isJunkToken(slugify(crop.name))) {
      errors.push(`junk crop name: ${cropId} (${crop.name})`);
    }
    if (crop.name.length <= 2) {
      errors.push(`crop name too short: ${cropId} (${crop.name})`);
    }
  }
  return errors;
}
