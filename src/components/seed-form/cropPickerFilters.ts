import type { CropDefinition } from "@/planning";

export const POPULAR_CROP_IDS = [
  "tomato",
  "pepper",
  "lettuce",
  "carrot",
  "broccoli",
  "beans",
  "cucumber",
  "pea",
  "kale",
  "basil",
  "spinach",
] as const;

const JUNK_CROP_IDS = new Set([
  "seed", "seeds", "organic", "red", "dry", "eco", "op", "winter", "type",
]);

/** Min varieties to appear in Browse tab */
export const MIN_BROWSE_VARIETIES = 3;

export type CropCategoryFilter = "popular" | "browse" | "vegetable" | "herb" | "fruit";

export const CROP_FILTERS: { id: CropCategoryFilter; label: string }[] = [
  { id: "popular", label: "Popular" },
  { id: "browse", label: "Browse" },
  { id: "vegetable", label: "Vegetables" },
  { id: "herb", label: "Herbs" },
  { id: "fruit", label: "Fruits" },
];

export const PAGE_SIZE = 24;

export function varietyCount(crop: CropDefinition) {
  return Object.keys(crop.varieties ?? {}).length;
}

export function isPickerCrop(crop: CropDefinition) {
  if (JUNK_CROP_IDS.has(crop.id)) return false;
  if (/^(seed|organic|red|dry)$/i.test(crop.name.trim())) return false;
  return true;
}

export function isBrowseCrop(crop: CropDefinition) {
  return isPickerCrop(crop) && varietyCount(crop) >= MIN_BROWSE_VARIETIES;
}

export function preparePickerCrops(crops: CropDefinition[]) {
  return crops.filter(isPickerCrop);
}

type FilterInput = {
  crops: CropDefinition[];
  query: string;
  category: CropCategoryFilter;
  page: number;
};

export function filterCrops({ crops, query, category, page }: FilterInput) {
  const pickerCrops = preparePickerCrops(crops);
  const q = query.trim().toLowerCase();
  let list: CropDefinition[];

  if (q) {
    list = pickerCrops.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  } else if (category === "popular") {
    const byId = new Map(pickerCrops.map((c) => [c.id, c]));
    list = POPULAR_CROP_IDS.map((id) => byId.get(id)).filter(
      (c): c is CropDefinition => c != null,
    );
  } else if (category === "browse") {
    list = pickerCrops.filter(isBrowseCrop);
  } else {
    list = pickerCrops.filter(
      (c) => c.category === category && isBrowseCrop(c),
    );
  }

  list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  const limit = page * PAGE_SIZE;
  const visible = list.slice(0, limit);

  return {
    visible,
    total: list.length,
    hasMore: visible.length < list.length,
  };
}
