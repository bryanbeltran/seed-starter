import { describe, expect, it } from "vitest";
import type { CropDefinition } from "@/planning";
import { filterCrops, PAGE_SIZE } from "./cropPickerFilters";

const crops: CropDefinition[] = [
  { id: "tomato", name: "Tomato", method: "transplant", daysToHarvest: 75, category: "vegetable" },
  { id: "basil", name: "Basil", method: "transplant", daysToHarvest: 45, category: "herb" },
  { id: "melon", name: "Melon", method: "transplant", daysToHarvest: 85, category: "fruit" },
  ...Array.from({ length: 60 }, (_, i) => ({
    id: `veg-${i}`,
    name: `Veg ${i}`,
    method: "direct" as const,
    daysToHarvest: 50,
    category: "vegetable" as const,
  })),
];

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
  });

  it("searches across all crops", () => {
    const { visible, total } = filterCrops({
      crops,
      query: "melon",
      category: "popular",
      page: 1,
    });
    expect(total).toBe(1);
    expect(visible[0]?.id).toBe("melon");
  });

  it("filters by category", () => {
    const { total } = filterCrops({
      crops,
      query: "",
      category: "vegetable",
      page: 1,
    });
    expect(total).toBe(61);
  });

  it("paginates large lists", () => {
    const page1 = filterCrops({ crops, query: "", category: "all", page: 1 });
    const page2 = filterCrops({ crops, query: "", category: "all", page: 2 });
    expect(page1.visible).toHaveLength(PAGE_SIZE);
    expect(page1.hasMore).toBe(true);
    expect(page2.visible.length).toBeGreaterThan(page1.visible.length);
  });
});
