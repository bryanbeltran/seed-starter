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
  catalogSource: z.object({
    sourceId: z.string(),
    sourceUrl: z.string().url(),
    retrievedAt: z.string().datetime(),
    symbol: z.string(),
    profileId: z.number().int().positive(),
    plantGuideUrl: z.string().url(),
  }).optional(),
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
  /** Units reviewed as whole-area coverage; mere spatial overlap does not qualify. */
  verifiedFinerAreaGeographies: z.array(z.literal("census-zcta-2010")).optional(),
  /** Date of a recorded source check; not a substitute for retrievedAt. */
  sourceCheckDate: z.string().nullable().optional(),
  /** Preserve literal source categories without normalizing their meanings. */
  sourceStatusCategories: z.array(z.string()).optional(),
});

export const nativeSourcesFileSchema = z.object({
  version: z.string(),
  sources: z.record(z.string(), nativeSourceSchema),
});

export const bonapCountyMapReviewSchema = z.object({
  plantId: z.string(),
  scientificName: z.string().min(1),
  mapUrl: z.string().url(),
  mapSha256: z.string().regex(/^[a-f0-9]{64}$/),
  mapGenerationDateFromContent: z.string().date().nullable(),
  taxonomyMatch: z.enum(["exact", "ambiguous", "unresolved"]),
  mapScopeDecision: z.enum([
    "confirmed_taxon_scope",
    "may_conflate_infraspecific",
    "unresolved",
  ]),
  reviewStatus: z.enum(["approved", "rejected"]),
  currentStatusConfirmed: z.boolean(),
  reviewer: z.string().min(1),
  reviewedAt: z.string().datetime(),
  reviewNote: z.string().min(1),
  counties: z.array(z.object({
    countyFips: z.string().regex(/^\d{5}$/),
    rawCategory: z.string().min(1),
  })),
});

export const bonapCountyMapReviewFileSchema = z.object({
  version: z.literal("2"),
  mapKeyUrl: z.literal("http://bonap.org/MapKey.html"),
  provenance: z.string(),
  records: z.array(bonapCountyMapReviewSchema),
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
  /** The source claim covers this entire Census 2010 ZCTA, not just an overlap. */
  finerArea: z.object({
    geography: z.literal("census-zcta-2010"),
    zctaId: z.string().regex(/^\d{5}$/),
  }).optional(),
  nativityStatus: z.enum(["native", "not_native", "unknown"]),
  uncertainty: z.string().nullable(),
  /** BONAP claims are usable only when tied to a reviewed map snapshot and MapKey. */
  bonapReview: z
    .object({
      mapSha256: z.string().regex(/^[a-f0-9]{64}$/),
      mapKeyUrl: z.literal("http://bonap.org/MapKey.html"),
      mapGenerationDate: z.string().date().nullable(),
      mapGenerationDateSource: z.enum(["png_content_metadata", "visual_map_content"]).nullable(),
      etag: z.string().nullable(),
      lastModified: z.string().nullable(),
      rawCategory: z.string(),
      taxonomyMatch: z.enum(["exact", "ambiguous", "unresolved"]),
      mapScopeDecision: z.enum([
        "confirmed_taxon_scope",
        "may_conflate_infraspecific",
        "unresolved",
      ]),
      reviewStatus: z.enum(["approved", "pending", "rejected"]),
      currentStatusConfirmed: z.boolean(),
      reviewer: z.string().min(1),
      reviewedAt: z.string().datetime(),
      reviewNote: z.string().nullable(),
  })
    .optional(),
}).superRefine((record, context) => {
  if (record.spatialResolution === "finer") {
    if (!record.finerArea) {
      context.addIssue({ code: "custom", path: ["finerArea"], message: "finer evidence must identify its ZCTA footprint" });
    }
    if (record.countyFips !== null) {
      context.addIssue({ code: "custom", path: ["countyFips"], message: "ZCTA-wide finer evidence must not be assigned to one county" });
    }
  } else if (record.finerArea !== undefined) {
    context.addIssue({ code: "custom", path: ["finerArea"], message: "finerArea is only valid for finer evidence" });
  }
});

export const nativeRangeEvidenceFileSchema = z.object({
  version: z.string(),
  provenance: z.string(),
  records: z.array(nativeRangeEvidenceSchema),
});

export type NativeSource = z.infer<typeof nativeSourceSchema>;
export type NativeRangeEvidence = z.infer<typeof nativeRangeEvidenceSchema>;
export type BonapCountyMapReview = z.infer<typeof bonapCountyMapReviewSchema>;

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

export const zctaCatalogFileSchema = z.object({
  version: z.string(),
  provenance: z.string(),
  zctaCount: z.number().int().nonnegative(),
  exactOverrideCount: z.number().int().nonnegative(),
  regionalFallbackCount: z.number().int().nonnegative(),
  nearestFallbackCount: z.number().int().nonnegative(),
  noCatalogCount: z.number().int().nonnegative(),
  plantSets: z.array(z.array(z.string())),
  zctas: z.record(
    z.string(),
    z.object({
      plantSetId: z.number().int().nonnegative(),
      ecoregionId: z.string().nullable(),
      fallbackEcoregionId: z.string().optional(),
      fallbackSourceZip: z.string().regex(/^\d{5}$/).optional(),
      mappingBasis: z.string(),
    }),
  ),
});
