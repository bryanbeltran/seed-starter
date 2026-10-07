import {
  isAffirmativeRangeClaims,
  isEligibleFinerRangeEvidenceRecord,
  isEligibleRangeEvidenceClaim,
  isNotNativeRangeClaims,
} from "./native-claim-eligibility.mjs";

/** Summarize enabled sources and observed claim coverage without treating metadata as evidence. */
export function summarizeNativeSourceEvidence(
  sources,
  records,
  lower48,
  mapSnapshots = [],
  bonapReviewRecords = [],
) {
  const stateByFips = new Map(lower48.map((state) => [state.fips, state]));
  const recordsBySource = new Map(Object.keys(sources).map((sourceId) => [sourceId, []]));
  for (const record of records) {
    recordsBySource.get(record.sourceId)?.push(record);
  }

  return Object.entries(sources).map(([sourceId, source]) => {
    const sourceRecords = recordsBySource.get(sourceId) ?? [];
    const finerAreaRecords = sourceRecords.filter(
      (record) => record.spatialResolution === "finer",
    );
    const eligibleFinerAreaRecords = finerAreaRecords.filter((record) =>
      isEligibleFinerRangeEvidenceRecord(record, { [sourceId]: source }),
    );
    const affirmativeFinerAreaRecords = eligibleFinerAreaRecords.filter((record) =>
      isAffirmativeRangeClaims(
        [record],
        { [sourceId]: source },
        mapSnapshots,
        record.finerArea?.zctaId,
        bonapReviewRecords,
      ),
    );
    const countyOrFinerRecords = sourceRecords.filter(
      (record) => record.spatialResolution === "county" || record.spatialResolution === "finer",
    );
    const countyRecords = countyOrFinerRecords.filter(
      (record) =>
        record.spatialResolution === "county" &&
        /^\d{5}$/.test(record.countyFips ?? ""),
    );
    const eligibleCountyRecords = countyRecords.filter((record) =>
      isEligibleRangeEvidenceClaim(
        record,
        { [sourceId]: source },
        mapSnapshots,
        null,
        bonapReviewRecords,
      ),
    );
    const eligibleAffirmativeRecords = eligibleCountyRecords.filter((record) =>
      isAffirmativeRangeClaims([record], { [sourceId]: source }, mapSnapshots, null, bonapReviewRecords),
    );
    const eligibleNotNativeRecords = eligibleCountyRecords.filter((record) =>
      isNotNativeRangeClaims([record], { [sourceId]: source }, mapSnapshots, null, bonapReviewRecords),
    );
    const countyCoverageByState = new Map(
      lower48.map((state) => [state.fips, {
        countyFipses: new Set(),
        recordCount: 0,
        eligibleCountyFipses: new Set(),
        eligibleRecordCount: 0,
        affirmativeCountyFipses: new Set(),
        affirmativeRecordCount: 0,
        notNativeRecordCount: 0,
      }]),
    );
    for (const record of countyRecords) {
      const stateFips = record.countyFips.slice(0, 2);
      const coverage = countyCoverageByState.get(stateFips);
      if (!coverage) continue;
      coverage.countyFipses.add(record.countyFips);
      coverage.recordCount++;
    }
    for (const record of eligibleCountyRecords) {
      const stateFips = record.countyFips.slice(0, 2);
      const coverage = countyCoverageByState.get(stateFips);
      if (!coverage) continue;
      coverage.eligibleCountyFipses.add(record.countyFips);
      coverage.eligibleRecordCount++;
      if (isAffirmativeRangeClaims([record], { [sourceId]: source }, mapSnapshots, null, bonapReviewRecords)) {
        coverage.affirmativeCountyFipses.add(record.countyFips);
        coverage.affirmativeRecordCount++;
      }
      if (isNotNativeRangeClaims([record], { [sourceId]: source }, mapSnapshots, null, bonapReviewRecords)) {
        coverage.notNativeRecordCount++;
      }
    }
    const lower48CountyFips = new Set(
      countyRecords
        .map((record) => record.countyFips)
        .filter((fips) => stateByFips.has(fips.slice(0, 2))),
    );
    const stateFipses = new Set(
      [...lower48CountyFips].map((fips) => fips.slice(0, 2)),
    );

    return {
      sourceId,
      authority: source.authority,
      ownerAuthorizationStatus: source.ownerAuthorizationNote
        ? "authorized"
        : "not_recorded",
      ownerAuthorizationNote: source.ownerAuthorizationNote ?? null,
      sourceTermsStatus: source.sourceTermsStatus ?? "unknown",
      rangeEvidenceAvailable: Boolean(source.rangeEvidenceAvailable),
      sourceStatusCategories: source.sourceStatusCategories ?? null,
      recordCount: sourceRecords.length,
      finerAreaRecordCount: finerAreaRecords.length,
      eligibleFinerAreaRecordCount: eligibleFinerAreaRecords.length,
      affirmativeFinerAreaRecordCount: affirmativeFinerAreaRecords.length,
      affirmativeFinerAreaZctaCount: new Set(
        affirmativeFinerAreaRecords.map((record) => record.finerArea?.zctaId),
      ).size,
      countyOrFinerRecordCount: countyOrFinerRecords.length,
      recordsNotCountyOrFinerCount: sourceRecords.length - countyOrFinerRecords.length,
      eligibleCountyOrFinerRecordCount:
        eligibleCountyRecords.length + eligibleFinerAreaRecords.length,
      eligibleAffirmativeCountyRecordCount: eligibleAffirmativeRecords.length,
      eligibleNotNativeCountyRecordCount: eligibleNotNativeRecords.length,
      lower48CountyFipsCount: lower48CountyFips.size,
      lower48StateCount: stateFipses.size,
      statesWithCountyEvidence: [...stateFipses]
        .sort()
        .map((fips) => {
          const state = stateByFips.get(fips);
          return {
            stateCode: state.code ?? null,
            state: state.name,
            stateFips: fips,
          };
        }),
      lower48StateCoverage: lower48.map((state) => {
        const coverage = countyCoverageByState.get(state.fips);
        return {
          stateCode: state.code ?? null,
          state: state.name,
          stateFips: state.fips,
          countyOrFinerRecordCount: coverage.recordCount,
          countyFipsCount: coverage.countyFipses.size,
          eligibleCountyOrFinerRecordCount: coverage.eligibleRecordCount,
          eligibleCountyFipsCount: coverage.eligibleCountyFipses.size,
          affirmativeCountyRecordCount: coverage.affirmativeRecordCount,
          affirmativeCountyFipsCount: coverage.affirmativeCountyFipses.size,
          notNativeCountyRecordCount: coverage.notNativeRecordCount,
        };
      }),
      observedBonapRawCategoryCounts: sourceRecords.reduce((counts, record) => {
        const category = record.bonapReview?.rawCategory;
        if (typeof category === "string") counts[category] = (counts[category] ?? 0) + 1;
        return counts;
      }, {}),
    };
  });
}
