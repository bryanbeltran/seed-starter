#!/usr/bin/env node
/**
 * Discover additional native seed-start candidates from the USDA culturally
 * significant plant inventory.
 *
 *   pnpm run etl:natives-candidates           # fetch and preview
 *   pnpm run etl:natives-candidates -- --write # atomically publish candidates
 *
 * This is candidate selection only. The inventory's L48 status is not local
 * county evidence; county claims still come from the USDA PLANTS Counties
 * layer through etl:natives-range-evidence.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeScientificName } from "./lib/native-taxonomy.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const plantsPath = path.join(root, "data/natives/plants.json");
const discoveryPath = path.join(root, "data/natives/native-candidate-discovery.json");
const write = process.argv.includes("--write");

export const CULTURALLY_SIGNIFICANT_URL =
  "https://plantsservices.sc.egov.usda.gov/api/common/getCulturallySignificantplants";
export const PLANTS_API = "https://plantsservices.sc.egov.usda.gov/api";
export const CATALOG_SOURCE_ID = "usda-culturally-significant";

function stripTags(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Return the accepted genus + specific epithet, ignoring botanical authority. */
export function binomialName(value) {
  const clean = stripTags(value)
    .replace(/[×✕]/g, " x ")
    .replace(/[^A-Za-z0-9 .-]+/g, " ")
    .trim();
  const match = clean.match(/^(x\s+)?([A-Za-z][A-Za-z-]*)\s+([A-Za-z][A-Za-z-]*)/);
  if (!match) return "";
  return `${match[1] ?? ""}${match[2]} ${match[3]}`.trim();
}

function idFromScientificName(scientificName) {
  return normalizeScientificName(scientificName).replace(/\s+/g, "-");
}

function titleCaseCommonName(value) {
  const text = String(value ?? "").trim();
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function habitFromGrowthHabits(growthHabits) {
  const habits = Array.isArray(growthHabits) ? growthHabits.map(String) : [];
  if (habits.some((habit) => /graminoid|grass/i.test(habit))) return "grass";
  if (habits.some((habit) => /vine/i.test(habit))) return "vine";
  if (habits.some((habit) => /forb|herb/i.test(habit))) return "forb";
  if (habits.some((habit) => /shrub|subshrub/i.test(habit))) return "shrub";
  if (habits.some((habit) => /tree/i.test(habit))) return "tree";
  return null;
}

function profileGuideUrl(profile, row) {
  const guide = (profile.PlantGuideUrls ?? []).find((url) => /\.(?:pdf|docx)$/i.test(url));
  if (guide) return new URL(guide, "https://plantsservices.sc.egov.usda.gov").toString();
  const inventoryGuide = String(row?.FilePath ?? "").replaceAll("\\", "/");
  return inventoryGuide
    ? new URL(inventoryGuide, "https://plantsservices.sc.egov.usda.gov").toString()
    : null;
}

function l48NativeStatuses(profile) {
  return (profile.NativeStatuses ?? [])
    .filter((status) => status?.Region === "L48")
    .map((status) => ({
      region: String(status.Region),
      status: String(status.Status ?? ""),
      type: String(status.Type ?? ""),
    }));
}

function isExactSpeciesInventoryRow(row) {
  return (
    typeof row?.Symbol === "string" &&
    /^[A-Z0-9]+$/i.test(row.Symbol) &&
    /^[A-Z][A-Za-z-]*\s+[a-z][A-Za-z-]*$/.test(String(row.ScientificName ?? "").trim())
  );
}

export function buildCandidatePlant(row, profile, retrievedAt) {
  const inventoryName = String(row.ScientificName ?? "").trim();
  const acceptedName = binomialName(profile.ScientificName);
  const l48Statuses = l48NativeStatuses(profile);
  const habit = habitFromGrowthHabits(profile.GrowthHabits);
  const guideUrl = profileGuideUrl(profile, row);
  if (!isExactSpeciesInventoryRow(row)) return { status: "excluded_infraspecific", row };
  if (profile.Rank !== "Species" || binomialName(inventoryName) !== acceptedName) {
    return { status: "excluded_taxonomy", row, profile };
  }
  if (!l48Statuses.some((status) => status.type === "Native")) {
    return { status: "excluded_l48_status", row, profile, l48Statuses };
  }
  if (!habit || !guideUrl) {
    return { status: "excluded_seed_guide", row, profile, l48Statuses, guideUrl };
  }

  const scientificName = acceptedName;
  return {
    status: "included",
    plant: {
      id: idFromScientificName(scientificName),
      commonName: titleCaseCommonName(row.CommonName),
      scientificName,
      habit,
      method: "direct",
      confidence: "low",
      sourceUrl: `https://plants.usda.gov/plant-profile?symbol=${encodeURIComponent(row.Symbol)}`,
      catalogSource: {
        sourceId: CATALOG_SOURCE_ID,
        sourceUrl: CULTURALLY_SIGNIFICANT_URL,
        retrievedAt,
        symbol: row.Symbol,
        profileId: profile.Id,
        plantGuideUrl: guideUrl,
      },
    },
    discovery: {
      symbol: row.Symbol,
      profileId: profile.Id,
      inventoryScientificName: inventoryName,
      inventoryCommonName: row.CommonName ?? null,
      acceptedScientificName: profile.ScientificName ?? null,
      acceptedScientificNameBinomial: scientificName,
      rank: profile.Rank,
      growthHabits: profile.GrowthHabits ?? [],
      l48NativeStatuses: l48Statuses,
      plantGuideUrls: profile.PlantGuideUrls ?? [],
      selectedPlantId: idFromScientificName(scientificName),
      selectionStatus: "included",
    },
  };
}

async function request(url, fetchImpl = fetch) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetchImpl(url, { headers: { accept: "application/json" } });
      if (response.ok) return response;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 4) throw new Error(`USDA request failed (${response.status}): ${url}`);
      const retryAfter = Number(response.headers?.get?.("retry-after")) || 0;
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 300 * 2 ** attempt)));
    } catch (error) {
      lastError = error;
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    }
  }
  throw lastError ?? new Error(`USDA request failed: ${url}`);
}

async function getJson(url, fetchImpl) {
  return (await request(url, fetchImpl)).json();
}

function uniqueInventoryRows(inventory) {
  const bySymbol = new Map();
  for (const row of inventory) {
    if (!row?.Symbol) continue;
    const previous = bySymbol.get(row.Symbol);
    const comparable = (value) => JSON.stringify({
      ScientificName: value.ScientificName,
      SynScientificName: value.SynScientificName,
      CommonName: value.CommonName,
      FilePath: value.FilePath,
    });
    if (previous && comparable(previous) !== comparable(row)) {
      throw new Error(`Culturally significant inventory has conflicting rows for ${row.Symbol}`);
    }
    bySymbol.set(row.Symbol, row);
  }
  return [...bySymbol.values()];
}

async function resolveRow(row, fetchImpl, retrievedAt) {
  const searchUrl = new URL(`${PLANTS_API}/PlantSearch`);
  searchUrl.searchParams.set("searchText", row.Symbol);
  const search = await getJson(searchUrl, fetchImpl);
  if (!Array.isArray(search)) throw new Error(`PlantSearch response is not an array for ${row.Symbol}`);
  const exact = search.filter((result) => result?.Plant?.Symbol === row.Symbol);
  if (exact.length !== 1) return { status: "unresolved_search", row, matchCount: exact.length };
  const searchPlant = exact[0].Plant;
  const profile = await getJson(`${PLANTS_API}/PlantProfile/${searchPlant.Id}`, fetchImpl);
  if (profile.Symbol !== row.Symbol || Number(profile.Id) !== Number(searchPlant.Id)) {
    throw new Error(`PlantProfile did not match PlantSearch for ${row.Symbol}`);
  }
  return buildCandidatePlant(row, profile, retrievedAt);
}

export async function fetchCandidateDiscovery({
  fetchImpl = fetch,
  now = new Date(),
  onRow = () => {},
} = {}) {
  const retrievedAt = now.toISOString();
  const inventory = await getJson(CULTURALLY_SIGNIFICANT_URL, fetchImpl);
  if (!Array.isArray(inventory) || inventory.length < 200) {
    throw new Error("USDA culturally significant inventory is missing or unexpectedly small");
  }
  const rows = uniqueInventoryRows(inventory);
  const results = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      const result = await resolveRow(row, fetchImpl, retrievedAt);
      results.push(result);
      onRow({ symbol: row.Symbol, status: result.status });
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  const included = results.filter((result) => result.status === "included");
  const plantsById = new Map();
  for (const result of included) {
    const existing = plantsById.get(result.plant.id);
    if (existing && JSON.stringify(existing.plant) !== JSON.stringify(result.plant)) {
      throw new Error(`Culturally significant inventory maps multiple records to ${result.plant.id}`);
    }
    plantsById.set(result.plant.id, result);
  }
  return {
    version: "usda-culturally-significant-v1",
    sourceId: CATALOG_SOURCE_ID,
    sourceUrl: CULTURALLY_SIGNIFICANT_URL,
    retrievedAt,
    provenance:
      "USDA PLANTS culturally significant plant inventory joined to exact USDA PlantSearch symbols and PlantProfile records. Only accepted species with an L48 Native profile status, a recognized growth habit, and a USDA plant-guide URL are included as candidate seed-start plants. L48 status and inventory membership are candidate-selection metadata, not local county nativity evidence; county claims are imported separately from the USDA PLANTS Counties layer.",
    inventoryRowCount: inventory.length,
    uniqueInventoryRowCount: rows.length,
    includedCandidateCount: plantsById.size,
    excludedCounts: results.reduce((counts, result) => {
      counts[result.status] = (counts[result.status] ?? 0) + 1;
      return counts;
    }, {}),
    records: results
      .filter((result) => result.discovery)
      .map((result) => ({ ...result.discovery, retrievedAt })),
    plants: Object.fromEntries(
      [...plantsById.values()]
        .sort((left, right) => left.plant.id.localeCompare(right.plant.id))
        .map((result) => [result.plant.id, result.plant]),
    ),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeAtomically(filePath, value) {
  const stagedPath = `${filePath}.staged`;
  fs.writeFileSync(stagedPath, `${JSON.stringify(value, null, 2)}\n`);
  try {
    fs.renameSync(stagedPath, filePath);
  } catch (error) {
    fs.rmSync(stagedPath, { force: true });
    throw error;
  }
}

export function mergeCandidatePlants(existingPlants, discoveredPlants) {
  const merged = { ...existingPlants };
  const existingByScientificName = new Map(
    Object.values(existingPlants).map((plant) => [normalizeScientificName(plant.scientificName), plant.id]),
  );
  for (const [id, plant] of Object.entries(discoveredPlants)) {
    const existingId = existingByScientificName.get(normalizeScientificName(plant.scientificName));
    if (existingId) continue;
    if (merged[id]) throw new Error(`Candidate ID ${id} already exists with a different taxon`);
    merged[id] = plant;
  }
  return Object.fromEntries(Object.entries(merged).sort(([left], [right]) => left.localeCompare(right)));
}

export async function main() {
  const discovery = await fetchCandidateDiscovery({
    onRow: ({ symbol, status }) => console.log(`${symbol}: ${status}`),
  });
  const current = readJson(plantsPath);
  const mergedPlants = mergeCandidatePlants(current.plants, discovery.plants);
  console.log(
    `inventory=${discovery.inventoryRowCount} unique=${discovery.uniqueInventoryRowCount} included=${discovery.includedCandidateCount} added=${Object.keys(mergedPlants).length - Object.keys(current.plants).length} total=${Object.keys(mergedPlants).length}`,
  );
  if (!write) {
    console.log("dry-run (pass --write to save)");
    return;
  }
  const output = {
    ...current,
    version: "2",
    provenance:
      `${current.provenance} Additional candidates are sourced from the USDA culturally significant plant inventory; see native-candidate-discovery.json for raw selection provenance.`,
    plants: mergedPlants,
  };
  writeAtomically(discoveryPath, discovery);
  writeAtomically(plantsPath, output);
  console.log(`wrote ${discoveryPath}`);
  console.log(`wrote ${plantsPath} (${Object.keys(mergedPlants).length} plants)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
