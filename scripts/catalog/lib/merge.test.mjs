import { describe, expect, it } from "vitest";
import { inferCategoryFromCropId } from "./merge.mjs";

describe("inferCategoryFromCropId", () => {
  it("tags herbs", () => {
    expect(inferCategoryFromCropId("basil")).toBe("herb");
    expect(inferCategoryFromCropId("cilantro")).toBe("herb");
    expect(inferCategoryFromCropId("mint")).toBe("herb");
  });

  it("tags fruits", () => {
    expect(inferCategoryFromCropId("tomato")).toBe("fruit");
    expect(inferCategoryFromCropId("watermelon")).toBe("fruit");
    expect(inferCategoryFromCropId("strawberry")).toBe("fruit");
    expect(inferCategoryFromCropId("squash-summer")).toBe("fruit");
  });

  it("defaults to vegetable", () => {
    expect(inferCategoryFromCropId("lettuce")).toBe("vegetable");
    expect(inferCategoryFromCropId("carrot")).toBe("vegetable");
  });
});
