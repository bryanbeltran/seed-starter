import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, inferCategoryFromCropId, mergeRecords } from "./merge.mjs";

describe("decodeHtmlEntities", () => {
  it("decodes numeric, hexadecimal, named, and double-encoded entities", () => {
    expect(
      decodeHtmlEntities("Pruden&#39;s &#40;Purple&#41; &reg; Br&ucirc;l&eacute;e &amp; Co"),
    ).toBe("Pruden's (Purple) ® Brûlée & Co");
    expect(decodeHtmlEntities("Pruden&amp;#39;s")).toBe("Pruden's");
  });

  it("uses decoded names for labels while preserving legacy ids", () => {
    const catalog = mergeRecords([
      {
        source: "fixture",
        sourceUrl: "https://example.com/tomato",
        name: "Pruden&#39;s Purple",
        cropCategory: "tomato",
        daysToHarvest: 75,
        confidence: "high",
      },
    ]);
    const tomato = catalog.crops.tomato;
    expect(tomato.varieties["pruden-39-s-purple"]?.name).toBe("Pruden's Purple");
  });
});

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

  it("defaults vegetables for former grains", () => {
    expect(inferCategoryFromCropId("amaranth")).toBe("vegetable");
    expect(inferCategoryFromCropId("buckwheat")).toBe("vegetable");
    expect(inferCategoryFromCropId("corn")).toBe("vegetable");
  });
});
