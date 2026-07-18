import { describe, expect, it } from "vitest";
import type { CropDefinition } from "@/planning";
import {
  filterCrops,
  isPickerCrop,
  MIN_BROWSE_VARIETIES,
  PAGE_SIZE,
} from "./cropPickerFilters";

const crops: CropDefinition[] = [
  { id: "tomato", name: "Tomato", method: "transplant", daysToHarvest: 75, category: "vegetable" },
  { id: "basil", name: "Basil", method: "transplant", daysToHarvest: 45, category: "herb" },
  { id: "seed", name: "Seed", method: "direct", daysToHarvest: 60, category: "vegetable" },
  { id: "melon", name: "Melon", method: "transplant", daysToHarvest: 85, category: "fruit" },
  ...Array.from({ length: 60 }, (_, i) => ({
    id: `veg-${i}`,
    name: `Veg ${i}`,
    method: "direct" as const,
    daysToHarvest: 50,
    category: "vegetable" as const,
    varieties: Object.fromEntries(
      Array.from({ length: MIN_BROWSE_VARIETIES }, (_, j) => [`v${j}`, { id: `v${j}`, name: `V${j}` }]),
    ),
  })),
];

describe("isPickerCrop", () => {
  it("excludes junk crop ids", () => {
    expect(isPickerCrop(crops.find((c) => c.id === "seed")!)).toBe(false);
    expect(isPickerCrop(crops.find((c) => c.id === "tomato")!)).toBe(true);
  });
});

describe("filterCrops", () => {
  it("returns popular crops by default list", () => {
    const { visible, total } = filterCrops({
      crops,
      query: "",
      category: "popular",
      page: 1,
    });
    expect(total).toBe(2);
    expect(visible.map((c) => c.id)).toEqual(expect.arrayContaining(["tomato", "basil"]));
    expect(visible.some((c) => c.id === "seed")).toBe(false);
  });

  it("searches across picker crops only", () => {
    const { visible, total } = filterCrops({
      crops,
      query: "melon",
      category: "popular",
      page: 1,
    });
    expect(total).toBe(1);
    expect(visible[0]?.id).toBe("melon");
  });

  it("browse excludes low-variety noise", () => {
    const { total } = filterCrops({
      crops,
      query: "",
      category: "browse",
      page: 1,
    });
    expect(total).toBe(60);
    expect(total).toBeLessThan(crops.length);
  });

  it("paginates browse lists", () => {
    const page1 = filterCrops({ crops, query: "", category: "browse", page: 1 });
    const page2 = filterCrops({ crops, query: "", category: "browse", page: 2 });
    expect(page1.visible).toHaveLength(PAGE_SIZE);
    expect(page1.hasMore).toBe(true);
    expect(page2.visible.length).toBeGreaterThan(page1.visible.length);
  });
});
