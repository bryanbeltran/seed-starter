import { z } from "zod";
import { cropIds } from "../cropCatalog";

export const riskProfileSchema = z.enum([
  "conservative",
  "balanced",
  "aggressive",
]);

const cropSelectionSchema = z.object({
  cropId: z.string(),
  varietyId: z.string().optional(),
});

export const scheduleRequestSchema = z.object({
  zip: z
    .string()
    .trim()
    .min(1, "ZIP code is required.")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => /^\d{5}$/.test(v), "Enter a valid 5-digit US ZIP code."),
  seeds: z
    .array(z.string())
    .min(1, "Select at least one crop.")
    .transform((seeds) => [...new Set(seeds)]),
  cropSelections: z.array(cropSelectionSchema).optional(),
  riskProfile: riskProfileSchema.optional(),
});

export type ScheduleRequest = z.infer<typeof scheduleRequestSchema>;

export function parseScheduleRequest(
  body: unknown,
):
  | { success: true; data: ScheduleRequest }
  | { success: false; error: string } {
  const result = scheduleRequestSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { success: false, error: issue?.message ?? "Invalid request." };
  }
  return { success: true, data: result.data };
}

export const knownCropIds = cropIds;
