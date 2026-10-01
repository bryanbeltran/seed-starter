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
  /** Prefer fall-dormant sow when season=fall (uses first fall frost). */
  fallDormant: z.boolean().optional(),
  fallSowDaysBeforeFrost: z.number().optional(),
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

export const nativeSourceSchema = z.object({
  authority: z.string(),
  name: z.string(),
  citation: z.string(),
  url: z.string().url(),
  releaseOrObservationDate: z.string().nullable(),
  retrievedAt: z.string().nullable(),
  licenseNote: z.string().nullable(),
  geographicScope: z.string().nullable(),
  spatialResolution: z.string().nullable(),
  coverage: z.string().nullable(),
  uncertainty: z.string().nullable(),
  rangeEvidenceAvailable: z.boolean(),
  /** Project-owner permission, distinct from the source's own terms. */
  ownerAuthorizationNote: z.string().nullable().optional(),
  sourceTermsStatus: z.enum(["verified", "unverified", "unknown"]).optional(),
  /** Date of a recorded source check; not a substitute for retrievedAt. */
  sourceCheckDate: z.string().nullable().optional(),
  /** Preserve literal source categories without normalizing their meanings. */
  sourceStatusCategories: z.array(z.string()).optional(),
});

export const nativeSourcesFileSchema = z.object({
  version: z.string(),
  sources: z.record(z.string(), nativeSourceSchema),
});

export const nativeRangeEvidenceSchema = z.object({
  plantId: z.string(),
  sourceId: z.string(),
  sourceCitation: z.string().min(1),
  sourceUrl: z.string().url(),
  releaseOrObservationDate: z.string().nullable(),
  retrievedAt: z.string().nullable(),
  licenseNote: z.string().nullable(),
  geographicScope: z.string().nullable(),
  spatialResolution: z.enum(["county", "finer", "state", "unknown"]),
  countyFips: z.string().regex(/^\d{5}$/).nullable(),
  nativityStatus: z.enum(["native", "not_native", "unknown"]),
  uncertainty: z.string().nullable(),
});

export const nativeRangeEvidenceFileSchema = z.object({
  version: z.string(),
  provenance: z.string(),
  records: z.array(nativeRangeEvidenceSchema),
});

export type NativeSource = z.infer<typeof nativeSourceSchema>;
export type NativeRangeEvidence = z.infer<typeof nativeRangeEvidenceSchema>;

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
