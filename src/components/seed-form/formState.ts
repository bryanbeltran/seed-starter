import type { RiskProfile } from "@/planning";

export type CropSelection = {
  cropId: string;
  varietyId?: string;
};

export type FormState = {
  zip: string;
  selectedCrops: string[];
  varieties: Record<string, string | undefined>;
  riskProfile: RiskProfile;
  compareMode: boolean;
};

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
