import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cropSelectionsFromForm,
  defaultSeasonForDate,
  FORM_STORAGE_KEY,
  isValidZip,
  loadFormState,
  saveFormState,
} from "./formState";

describe("formState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it.each(["QuotaExceededError", "SecurityError"])(
    "does not interrupt form updates when storage throws %s",
    (name) => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("Storage unavailable", name);
      });

      expect(() => saveFormState({
        zip: "55423",
        selectedCrops: ["tomato"],
        varieties: {},
        riskProfile: "balanced",
        season: "spring",
        compareMode: false,
      })).not.toThrow();
    },
  );

  it("validates zip codes", () => {
    expect(isValidZip("55423")).toBe(true);
    expect(isValidZip("abc")).toBe(false);
  });

  it("builds crop selections with varieties", () => {
    expect(
      cropSelectionsFromForm(["tomato"], { tomato: "cherry" }),
    ).toEqual([{ cropId: "tomato", varietyId: "cherry" }]);
  });

  it("persists and loads form state including season", () => {
    saveFormState({
      zip: "55423",
      selectedCrops: ["tomato"],
      varieties: {},
      riskProfile: "balanced",
      season: "fall",
      compareMode: false,
    });
    const loaded = loadFormState();
    expect(loaded?.zip).toBe("55423");
    expect(loaded?.season).toBe("fall");
    expect(sessionStorage.getItem(FORM_STORAGE_KEY)).toBeTruthy();
  });

  it("returns null for invalid stored state", () => {
    sessionStorage.setItem(FORM_STORAGE_KEY, "{not json");
    expect(loadFormState()).toBeNull();
  });

  it("defaults season to spring", () => {
    expect(defaultSeasonForDate(new Date(2026, 2, 15))).toBe("spring");
    expect(defaultSeasonForDate(new Date(2026, 7, 15))).toBe("spring");
  });
});
