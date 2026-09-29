import type { GardenSeason, RiskProfile } from "@/planning";
import { z } from "zod";

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

/** First paint before ZIP resolve. Frost-aware suggest runs on location preview. */
export function defaultSeasonForDate(_now?: Date): GardenSeason {
  void _now;
  return "spring";
}

export const FORM_STORAGE_KEY = "seedstarter-form";

// Older sessions may omit fields, but any restored values must be safe for the form.
const storedFormSchema = z.object({
  zip: z.string(),
  selectedCrops: z.array(z.string()),
  varieties: z.record(z.string(), z.string().optional()),
  riskProfile: z.enum(["conservative", "balanced", "aggressive"]),
  season: z.enum(["spring", "fall", "summer"]),
  compareMode: z.boolean(),
}).partial();

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
    if (!raw) return null;
    const parsed = storedFormSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveFormState(state: FormState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is optional: blocked or full storage must not break the form.
  }
}

export function isValidZip(zip: string) {
  return /^\d{5}$/.test(zip.replace(/\D/g, ""));
}
