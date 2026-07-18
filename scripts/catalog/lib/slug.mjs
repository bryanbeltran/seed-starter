const CROP_ALIASES = {
  "bush beans": "beans",
  "pole beans": "beans",
  "shell beans": "beans",
  "dry beans": "beans",
  "lima beans": "beans",
  "fava beans": "beans",
  "soybeans": "beans",
  "garbanzo beans": "beans",
  "bush bean": "beans",
  "pole bean": "beans",
  "slicing tomatoes": "tomato",
  "cherry tomatoes": "tomato",
  "paste tomatoes": "tomato",
  "heirloom tomatoes": "tomato",
  "beefsteak tomatoes": "tomato",
  "grape tomatoes": "tomato",
  "salad tomatoes": "tomato",
  "kale and collards": "kale",
  collards: "kale",
  "asian greens": "asian-greens",
  "summer squash": "squash-summer",
  "winter squash": "squash-winter",
  "sweet corn": "corn",
  "popcorn": "corn",
  melons: "melon",
  watermelons: "watermelon",
  herbs: "herb",
  greens: "greens",
  "brussels sprouts": "brussels-sprouts",
  cauliflowers: "cauliflower",
  cabbages: "cabbage",
  cucumbers: "cucumber",
  eggplants: "eggplant",
  peppers: "pepper",
  tomatoes: "tomato",
  "hot peppers": "pepper",
  "sweet peppers": "pepper",
  "bell peppers": "pepper",
  "early carrots": "carrot",
  "storage carrots": "carrot",
  "main crop carrots": "carrot",
  "colored carrots": "carrot",
  carrots: "carrot",
  peppers: "pepper",
  beets: "beet",
  carrots: "carrot",
  onions: "onion",
  potatoes: "potato",
  peas: "pea",
  beans: "beans",
  lettuce: "lettuce",
  spinach: "spinach",
  broccoli: "broccoli",
  basil: "basil",
  kale: "kale",
  radishes: "radish",
  turnips: "turnip",
  parsnips: "parsnip",
  leeks: "leek",
  garlic: "garlic",
  pumpkins: "pumpkin",
  okra: "okra",
  celery: "celery",
  kohlrabi: "kohlrabi",
  fennel: "fennel",
  artichoke: "artichoke",
  asparagus: "asparagus",
  grains: "grain",
  mushrooms: "mushroom",
};

export function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function cropIdFromCategory(category) {
  const key = category.trim().toLowerCase();
  if (CROP_ALIASES[key]) return CROP_ALIASES[key];
  const slug = slugify(category);
  if (CROP_ALIASES[slug]) return CROP_ALIASES[slug];
  if (slug.endsWith("-carrots") || slug === "carrots") return "carrot";
  if (slug.endsWith("-peppers") || slug === "peppers") return "pepper";
  if (slug.endsWith("-tomatoes") || slug === "tomatoes") return "tomato";
  if (slug.endsWith("-beans") || slug === "beans") return "beans";
  if (slug.endsWith("-lettuce") || slug === "lettuces") return "lettuce";
  if (slug.endsWith("-onions") || slug === "onions") return "onion";
  if (slug.endsWith("-melons") || slug === "melons") return "melon";
  if (slug.includes("microgreen")) return "microgreens";
  return slug.replace(/-seeds?$/, "").replace(/-seed$/, "");
}

export function varietyId(name, cropId) {
  const base = slugify(name);
  return base || `${cropId}-variety`;
}

export function displayName(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
