import type { GardenSeason, RiskProfile } from "@/planning";

export type CropSelection = {
  cropId: string;
  varietyId?: string;
};

export type FormState = {
  zip: string;
  selectedCrops: string[];
  varieties: Record<string, string | undefined>;
  riskProfile: RiskProfile;
  season: GardenSeason;
  compareMode: boolean;
};

/**
 * Temporary MVP heuristic: assume fall planning from July onward.
 * TODO: swap for a proper user-set default once fall catalog data lands.
 */
export function defaultSeasonForDate(now: Date = new Date()): GardenSeason {
  return now.getMonth() >= 6 ? "fall" : "spring";
}

export const FORM_STORAGE_KEY = "seedstarter-form";

export function cropSelectionsFromForm(
  selectedCrops: string[],
  varieties: Record<string, string | undefined>,
): CropSelection[] {
  return selectedCrops.map((cropId) => ({
    cropId,
    varietyId: varieties[cropId],
  }));
}

export function loadFormState(): Partial<FormState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FORM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<FormState>) : null;
  } catch {
    return null;
  }
}

export function saveFormState(state: FormState) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(state));
}

export function isValidZip(zip: string) {
  return /^\d{5}$/.test(zip.replace(/\D/g, ""));
}
