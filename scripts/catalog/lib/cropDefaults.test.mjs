import { describe, expect, it } from "vitest";
import { KNOWN_CROP_IDS } from "./cropResolve.mjs";
import { cropDefaults, CROP_DEFAULT_IDS } from "./cropDefaults.mjs";

describe("cropDefaults", () => {
  it("covers every known crop id", () => {
    const missing = [...KNOWN_CROP_IDS].filter((id) => !CROP_DEFAULT_IDS.includes(id));
    expect(missing, `missing defaults: ${missing.join(", ")}`).toEqual([]);
  });

  it("differentiates warm vs cool direct sow", () => {
    expect(cropDefaults("carrot").directSowDaysBeforeFrost).toBe(14);
    expect(cropDefaults("pumpkin").directSowDaysBeforeFrost).toBe(-14);
    expect(cropDefaults("squash-summer").directSowDaysBeforeFrost).toBe(-7);
  });
});
