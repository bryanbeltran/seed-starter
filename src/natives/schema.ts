import { z } from "zod";

export const nativePlantSchema = z.object({
  id: z.string(),
  commonName: z.string(),
  scientificName: z.string(),
  habit: z.enum(["forb", "grass", "shrub", "tree", "vine"]),
  light: z.enum(["full-sun", "part-shade", "shade"]).optional(),
  moisture: z.enum(["dry", "medium", "wet"]).optional(),
  needsStratification: z.boolean().optional(),
  stratificationDays: z.number().optional(),
  method: z.enum(["direct", "transplant"]),
  indoorSowOffsetDays: z.number().optional(),
  transplantDaysAfterFrost: z.number().optional(),
  directSowDaysBeforeFrost: z.number().optional(),
  sourceUrl: z.string().url(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type NativePlant = z.infer<typeof nativePlantSchema>;

export const nativesFileSchema = z.object({
  version: z.string(),
  provenance: z.string(),
  plants: z.record(z.string(), nativePlantSchema),
});

export const ecoregionPlantsFileSchema = z.object({
  ecoregions: z.record(
    z.string(),
    z.object({
      ecoregionId: z.string(),
      name: z.string(),
      plantIds: z.array(z.string()),
      provenance: z.string(),
    }),
  ),
});
