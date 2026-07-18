import { describe, expect, it } from "vitest";
import {
  inferCropFromName,
  inferCropFromUrl,
  isValidCropId,
  resolveCropRecord,
} from "./cropResolve.mjs";

describe("cropResolve", () => {
  it("rejects junk crop ids", () => {
    expect(isValidCropId("seed")).toBe(false);
    expect(isValidCropId("red")).toBe(false);
    expect(isValidCropId("de")).toBe(false);
    expect(isValidCropId("y")).toBe(false);
    expect(isValidCropId("tomato")).toBe(true);
    expect(isValidCropId("beans")).toBe(true);
  });

  it("infers crop from product name", () => {
    expect(inferCropFromName("Provider Bush Bean")).toBe("beans");
    expect(inferCropFromName("Red Russian Kale")).toBe("kale");
    expect(inferCropFromName("Seedless Cucumber")).toBe("cucumber");
  });

  it("infers crop from johnnys url path", () => {
    expect(
      inferCropFromUrl(
        "https://www.johnnyseeds.com/vegetables/beans/bush-beans/provider-bean-seed-10.html",
      ),
    ).toBe("beans");
  });

  it("drops territorial Type:SEED mis-tags", () => {
    expect(
      resolveCropRecord({
        sourceUrl: "https://territorialseed.com/products/artichoke-green-globe",
        cropCategory: "seed",
        name: "Green Globe Artichoke",
      }),
    ).toBe("artichoke");
  });

  it("drops unresolvable records", () => {
    expect(
      resolveCropRecord({
        sourceUrl: "https://example.com/products/foo-bar",
        cropCategory: "de",
        name: "Mystery Widget",
      }),
    ).toBeNull();
  });
});
