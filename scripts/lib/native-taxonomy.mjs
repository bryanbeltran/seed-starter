/** Normalize spacing, case, accents, and punctuation while preserving every epithet. */
export function normalizeScientificName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[×✕]/g, " x ")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Exact whole-name crosswalk. Ambiguous normalized duplicates never select a row. */
export function matchScientificName(scientificName, candidates, getName = (row) => row.scientificName) {
  const wanted = normalizeScientificName(scientificName);
  if (!wanted) return { status: "unresolved", matches: [] };
  const matches = candidates.filter((candidate) => normalizeScientificName(getName(candidate)) === wanted);
  if (matches.length === 1) return { status: "exact", matches };
  return { status: matches.length > 1 ? "ambiguous" : "unresolved", matches };
}
