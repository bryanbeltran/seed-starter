import { addDays, subDays } from "date-fns";
import plantsData from "../../data/natives/plants.json";
import ecoregionPlantsData from "../../data/natives/ecoregion-plants.json";
import nativeSourcesData from "../../data/natives/native-sources.json";
import nativeRangeEvidenceData from "../../data/natives/plant-range-evidence.json";
import nativeSourceIngestionData from "../../data/natives/native-source-ingestion.json";
import bonapCountyMapReviewsData from "../../data/natives/bonap-county-map-reviews.json";
import { isKnownZctaId, lookupZipCounty, lookupZipCountyFips } from "./lookupCounty";
import { lookupZipEcoregion, type EcoregionRef } from "./lookupEcoregion";
import {
  ecoregionPlantsFileSchema,
  bonapCountyMapReviewFileSchema,
  nativeRangeEvidenceFileSchema,
  nativeSourcesFileSchema,
  nativesFileSchema,
  type NativeRangeEvidence,
  type NativePlant,
} from "./schema";
import type { BonapMapSnapshotRef } from "./rangeEvidence";
import {
  affirmativeCountyEvidenceForPlant,
  bonapReviewsMatchingCatalogTaxa,
  conflictingCountyEvidenceForPlant,
  summarizeNativeRangeEvidence,
  type NativeRangeEvidenceSummary,
} from "./rangeEvidence";
import { resolveFrost } from "@/planning/frostResolver";
import { selectFrostDate } from "@/planning/riskProfile";
import type { FrostClimateLookup, GardenSeason, RiskProfile } from "@/planning/types";

const plantsFile = nativesFileSchema.parse(plantsData);
const ecoregionFile = ecoregionPlantsFileSchema.parse(ecoregionPlantsData);
const nativeSourcesFile = nativeSourcesFileSchema.parse(nativeSourcesData);
const nativeRangeEvidenceFile = nativeRangeEvidenceFileSchema.parse(
  nativeRangeEvidenceData,
);
const currentBonapMapSnapshots = (
  nativeSourceIngestionData as unknown as {
    bonap?: { mapSnapshots?: BonapMapSnapshotRef[] };
  }
).bonap?.mapSnapshots ?? [];
const currentBonapMapReviews = bonapReviewsMatchingCatalogTaxa(
  bonapCountyMapReviewFileSchema.parse(bonapCountyMapReviewsData).records,
  plantsFile.plants,
);

export type NativeTask = {
  type: "direct_sow" | "indoor_sow" | "transplant" | "fall_sow";
  date: Date;
  label: string;
};

export type NativePlantResult = NativePlant & {
  tasks: NativeTask[];
  rangeEvidence: NativeRangeEvidence[];
  rangeEvidenceConflicts: NativeRangeEvidence[];
};

export type NativeRangeEvidenceConflict = {
  plantId: string;
  commonName: string;
  scientificName: string;
  claims: NativeRangeEvidence[];
  recommended: boolean;
};

export type CountyOverlay = {
  fips: string;
  name: string;
  state: string;
};

export type ResolveNativesResult = {
  zip: string;
  zone: string;
  season: GardenSeason;
  riskProfile: RiskProfile;
  ecoregion: EcoregionRef | null;
  county: CountyOverlay | null;
  lastFrostDate: Date;
  frostSource: string;
  frostProvenance: string;
  plants: NativePlantResult[];
  rangeEvidenceConflicts: NativeRangeEvidenceConflict[];
  catalogCoverage: "full" | "none" | "unknown";
  rangeEvidenceCoverage: NativeRangeEvidenceSummary;
};

export function buildNativeRangeEvidenceConflicts(
  candidates: NativePlantResult[],
  recommendedPlants: NativePlantResult[],
): NativeRangeEvidenceConflict[] {
  const recommendedIds = new Set(recommendedPlants.map((plant) => plant.id));
  return candidates
    .filter((plant) => plant.rangeEvidenceConflicts.length > 0)
    .map((plant) => ({
      plantId: plant.id,
      commonName: plant.commonName,
      scientificName: plant.scientificName,
      claims: plant.rangeEvidenceConflicts,
      recommended: recommendedIds.has(plant.id),
    }));
}

function parseRiskProfile(raw?: RiskProfile | string | null): RiskProfile {
  if (raw === "conservative" || raw === "aggressive") return raw;
  return "balanced";
}

export function tasksForPlant(
  plant: NativePlant,
  frost: Date,
  season: GardenSeason,
): NativeTask[] {
  if (season === "fall") {
    if (!plant.fallDormant) return [];
    const before =
      plant.fallSowDaysBeforeFrost ?? plant.stratificationDays ?? 14;
    return [
      {
        type: "fall_sow",
        date: subDays(frost, before),
        label: `Fall dormant sow ${plant.commonName}`,
      },
    ];
  }

  const tasks: NativeTask[] = [];
  if (plant.method === "transplant") {
    const transplant = addDays(frost, plant.transplantDaysAfterFrost ?? 0);
    const indoor = subDays(frost, plant.indoorSowOffsetDays ?? 30);
    tasks.push({
      type: "indoor_sow",
      date: indoor,
      label: `Sow ${plant.commonName} indoors`,
    });
    tasks.push({
      type: "transplant",
      date: transplant,
      label: `Transplant ${plant.commonName}`,
    });
    return tasks;
  }

  if (plant.stratificationDays != null) {
    tasks.push({
      type: "direct_sow",
      date: subDays(frost, plant.stratificationDays),
      label: `Direct sow ${plant.commonName} (cold stratification window)`,
    });
    return tasks;
  }

  const before = plant.directSowDaysBeforeFrost ?? 0;
  tasks.push({
    type: "direct_sow",
    date: subDays(frost, before),
    label: `Direct sow ${plant.commonName}`,
  });
  return tasks;
}

export function resolveNatives(input: {
  zip: string;
  zone: string;
  season?: GardenSeason;
  riskProfile?: RiskProfile | string | null;
  referenceDate?: Date;
  climateLookup?: FrostClimateLookup;
}): ResolveNativesResult {
  const season: GardenSeason = input.season === "fall" ? "fall" : "spring";
  const riskProfile = parseRiskProfile(input.riskProfile);
  const ecoregion = lookupZipEcoregion(input.zip);
  const county = lookupZipCounty(input.zip);
  const countyFipses = lookupZipCountyFips(input.zip);
  const targetZctaId = isKnownZctaId(input.zip) ? input.zip : null;
  const frostResolution = resolveFrost(
    {
      zone: input.zone,
      zip: input.zip,
      referenceDate: input.referenceDate,
      season,
    },
    input.climateLookup,
  );
  const lastFrostDate = selectFrostDate(frostResolution, riskProfile, season);

  const base = {
    zip: input.zip,
    zone: input.zone,
    season,
    riskProfile,
    county,
    lastFrostDate,
    frostSource: frostResolution.source,
    frostProvenance: frostResolution.provenance,
  };

  if (!ecoregion) {
    return {
      ...base,
      ecoregion: null,
      plants: [],
      rangeEvidenceConflicts: [],
      catalogCoverage: "unknown",
      rangeEvidenceCoverage: summarizeNativeRangeEvidence({
        candidateIds: [],
        countyFips: countyFipses,
        geographyResolved: countyFipses.length > 0 || targetZctaId !== null,
        catalogAvailable: false,
        evidence: nativeRangeEvidenceFile.records,
        sources: nativeSourcesFile.sources,
        currentBonapMapSnapshots,
        currentBonapMapReviews,
        targetZctaId,
      }),
    };
  }

  const listing = ecoregionFile.ecoregions[ecoregion.id];
  if (!listing?.plantIds.length) {
    return {
      ...base,
      ecoregion: { id: ecoregion.id, name: ecoregion.name },
      plants: [],
      rangeEvidenceConflicts: [],
      catalogCoverage: "none",
      rangeEvidenceCoverage: summarizeNativeRangeEvidence({
        candidateIds: [],
        countyFips: countyFipses,
        geographyResolved: Boolean(ecoregion && (countyFipses.length || targetZctaId)),
        catalogAvailable: false,
        evidence: nativeRangeEvidenceFile.records,
        sources: nativeSourcesFile.sources,
        currentBonapMapSnapshots,
        currentBonapMapReviews,
        targetZctaId,
      }),
    };
  }

  const candidates = listing.plantIds
    .map((id) => plantsFile.plants[id])
    .filter((plant): plant is NativePlant => Boolean(plant));
  const rangeEvidenceCoverage = summarizeNativeRangeEvidence({
    candidateIds: candidates.map((plant) => plant.id),
    countyFips: countyFipses,
    geographyResolved: Boolean(ecoregion && (countyFipses.length || targetZctaId)),
    catalogAvailable: candidates.length > 0,
    evidence: nativeRangeEvidenceFile.records,
    sources: nativeSourcesFile.sources,
    currentBonapMapSnapshots,
    currentBonapMapReviews,
    targetZctaId,
  });
  const resolvedCandidates: NativePlantResult[] = candidates.map((plant) => {
    const rangeEvidence = affirmativeCountyEvidenceForPlant(
      plant.id,
      countyFipses,
      nativeRangeEvidenceFile.records,
      nativeSourcesFile.sources,
      currentBonapMapSnapshots,
      targetZctaId,
      currentBonapMapReviews,
    );
    const rangeEvidenceConflicts = conflictingCountyEvidenceForPlant(
      plant.id,
      countyFipses,
      nativeRangeEvidenceFile.records,
      nativeSourcesFile.sources,
      currentBonapMapSnapshots,
      targetZctaId,
      currentBonapMapReviews,
    );
    return {
      ...plant,
      tasks: tasksForPlant(plant, lastFrostDate, season),
      rangeEvidence,
      rangeEvidenceConflicts,
    };
  });
  const plants = resolvedCandidates.filter(
    (plant) => plant.rangeEvidence.length > 0 && plant.tasks.length > 0,
  );
  const rangeEvidenceConflicts = buildNativeRangeEvidenceConflicts(
    resolvedCandidates,
    plants,
  );

  return {
    ...base,
    ecoregion: { id: ecoregion.id, name: listing.name || ecoregion.name },
    plants,
    rangeEvidenceConflicts,
    catalogCoverage: "full",
    rangeEvidenceCoverage,
  };
}
