import { z } from "zod";

export const varietySchema = z.object({
  id: z.string(),
  name: z.string(),
  indoorSowOffsetDays: z.number().optional(),
  daysToHarvest: z.number().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  sku: z.string().optional(),
});

export const seasonTimingSchema = z.object({
  anchor: z.string(),
  method: z.enum(["transplant", "direct"]),
  indoorSowOffsetDays: z.number().optional(),
  hardenOffDaysBeforeTransplant: z.number().optional(),
  transplantDaysAfterAnchor: z.number().optional(),
  directSowDaysBeforeAnchor: z.number().optional(),
  /** Days after first sow for optional succession_sow (summer). */
  successionIntervalDays: z.number().optional(),
});

export const cropSchema = z.object({
  id: z.string(),
  name: z.string(),
  method: z.enum(["transplant", "direct"]),
  category: z.string().optional(),
  family: z.string().optional(),
  indoorSowOffsetDays: z.number().optional(),
  hardenOffDaysBeforeTransplant: z.number().optional(),
  transplantDaysAfterFrost: z.number().optional(),
  directSowDaysBeforeFrost: z.number().optional(),
  daysToHarvest: z.number(),
  successionIntervalDays: z.number().optional(),
  seasons: z
    .object({
      spring: seasonTimingSchema.optional(),
      summer: seasonTimingSchema.optional(),
      fall: seasonTimingSchema.optional(),
    })
    .optional(),
  source: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  varieties: z.record(z.string(), varietySchema).optional(),
});

export const catalogFileSchema = z.object({
  version: z.number(),
  generatedAt: z.string(),
  crops: z.record(z.string(), cropSchema),
});

export type VarietyDefinition = z.infer<typeof varietySchema>;
export type CropDefinition = z.infer<typeof cropSchema>;
export type CatalogFile = z.infer<typeof catalogFileSchema>;
