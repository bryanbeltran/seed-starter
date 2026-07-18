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
  "smooth-leaf-spinach",
] as const;

export type CropCategoryFilter = "popular" | "all" | "vegetable" | "herb" | "fruit";

export const CROP_FILTERS: { id: CropCategoryFilter; label: string }[] = [
  { id: "popular", label: "Popular" },
  { id: "all", label: "All" },
  { id: "vegetable", label: "Vegetables" },
  { id: "herb", label: "Herbs" },
  { id: "fruit", label: "Fruits" },
];

export const PAGE_SIZE = 48;

type FilterInput = {
  crops: CropDefinition[];
  query: string;
  category: CropCategoryFilter;
  page: number;
};

export function filterCrops({ crops, query, category, page }: FilterInput) {
  const q = query.trim().toLowerCase();
  let list: CropDefinition[];

  if (q) {
    list = crops.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  } else if (category === "popular") {
    const byId = new Map(crops.map((c) => [c.id, c]));
    list = POPULAR_CROP_IDS.map((id) => byId.get(id)).filter(
      (c): c is CropDefinition => c != null,
    );
  } else if (category === "all") {
    list = crops;
  } else {
    list = crops.filter((c) => c.category === category);
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
