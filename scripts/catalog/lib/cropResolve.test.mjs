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
    expect(inferCropFromName("Primed Rosemary")).toBe("rosemary");
    expect(inferCropFromName("Honeyboat Winter Squash")).toBe("squash-winter");
    expect(inferCropFromName("Athena Cantaloupe")).toBe("cantaloupe");
  });

  it("rejects catch-all and collection records", () => {
    expect(
      resolveCropRecord({
        sourceUrl: "https://example.com/herbs/rosemary",
        cropCategory: "herbs",
        name: "Kitchen Herbs Organic Seed Collection",
      }),
    ).toBeNull();
    expect(
      resolveCropRecord({
        sourceUrl: "https://example.com/greens",
        cropCategory: "greens",
        name: "Astro",
      }),
    ).toBe("arugula");
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

  it("maps microgreens and shoots before parent crops", () => {
    expect(inferCropFromName("Cabbage, Red")).toBe("cabbage");
    expect(
      resolveCropRecord({
        name: "Cabbage, Red",
        sourceUrl:
          "https://www.johnnyseeds.com/vegetables/microgreens/microgreen-vegetables/cabbage-red-microgreen-seed-2230M.html",
        cropCategory: "cabbage",
      }),
    ).toBe("microgreens");
    expect(inferCropFromName("Popcorn Shoots")).toBe("microgreens");
  });

  it("maps grape tomato names and tomato URLs to tomato", () => {
    expect(inferCropFromName("Five Star Grape")).toBe("tomato");
    expect(
      resolveCropRecord({
        name: "Five Star Grape",
        sourceUrl:
          "https://www.johnnyseeds.com/vegetables/tomatoes/grape-tomatoes/five-star-grape-f1-tomato-seed-2527.html",
        cropCategory: "grape",
      }),
    ).toBe("tomato");
  });

  it("maps kalettes to brussels-sprouts", () => {
    expect(inferCropFromName("Snowdrop Kalettes")).toBe("brussels-sprouts");
  });

  it("drops garlic chives and cardoon", () => {
    expect(
      resolveCropRecord({
        name: "Garlic Chives",
        sourceUrl: "https://www.highmowingseeds.com/organic-non-gmo-garlic-chives.html",
        cropCategory: "garlic",
      }),
    ).toBeNull();
    expect(
      resolveCropRecord({
        name: "Cardoon Artichoke",
        sourceUrl: "https://example.com/artichoke-cardoon",
        cropCategory: "artichoke",
      }),
    ).toBeNull();
  });
});
