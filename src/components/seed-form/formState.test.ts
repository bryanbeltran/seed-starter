import { afterEach, describe, expect, it } from "vitest";
import {
  cropSelectionsFromForm,
  FORM_STORAGE_KEY,
  isValidZip,
  loadFormState,
  saveFormState,
} from "./formState";

describe("formState", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("validates zip codes", () => {
    expect(isValidZip("55423")).toBe(true);
    expect(isValidZip("abc")).toBe(false);
  });

  it("builds crop selections with varieties", () => {
    expect(
      cropSelectionsFromForm(["tomato"], { tomato: "cherry" }),
    ).toEqual([{ cropId: "tomato", varietyId: "cherry" }]);
  });

  it("persists and loads form state", () => {
    saveFormState({
      zip: "55423",
      selectedCrops: ["tomato"],
      varieties: {},
      riskProfile: "balanced",
      compareMode: false,
    });
    expect(loadFormState()?.zip).toBe("55423");
    expect(sessionStorage.getItem(FORM_STORAGE_KEY)).toBeTruthy();
  });

  it("returns null for invalid stored state", () => {
    sessionStorage.setItem(FORM_STORAGE_KEY, "{not json");
    expect(loadFormState()).toBeNull();
  });
});
