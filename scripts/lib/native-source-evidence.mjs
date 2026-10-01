/** Summarize enabled sources and observed claim coverage without treating metadata as evidence. */
export function summarizeNativeSourceEvidence(sources, records, lower48) {
  const stateByFips = new Map(lower48.map((state) => [state.fips, state]));
  const recordsBySource = new Map(Object.keys(sources).map((sourceId) => [sourceId, []]));
  for (const record of records) {
    recordsBySource.get(record.sourceId)?.push(record);
  }

  return Object.entries(sources).map(([sourceId, source]) => {
    const sourceRecords = recordsBySource.get(sourceId) ?? [];
    const countyRecords = sourceRecords.filter(
      (record) =>
        (record.spatialResolution === "county" ||
          record.spatialResolution === "finer") &&
        /^\d{5}$/.test(record.countyFips ?? ""),
    );
    const countyCoverageByState = new Map(
      lower48.map((state) => [state.fips, { countyFipses: new Set(), recordCount: 0 }]),
    );
    for (const record of countyRecords) {
      const stateFips = record.countyFips.slice(0, 2);
      const coverage = countyCoverageByState.get(stateFips);
      if (!coverage) continue;
      coverage.countyFipses.add(record.countyFips);
      coverage.recordCount++;
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
      countyOrFinerRecordCount: countyRecords.length,
      recordsNotCountyOrFinerCount: sourceRecords.length - countyRecords.length,
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
        };
      }),
    };
  });
}
