#!/usr/bin/env node
/**
 * Convert registered BONAP county-map pixels into review rows.
 *
 * The converter is deliberately conservative: it binds every result to the
 * current downloaded PNG hash, uses only the published MapKey colors, samples
 * a registered county point at several radii, and omits unstable pixels.
 *
 *   node scripts/review-bonap-county-maps.mjs
 *   node scripts/review-bonap-county-maps.mjs --write
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import proj4 from "proj4";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ingestionPath = path.join(root, "data/natives/native-source-ingestion.json");
const plantsPath = path.join(root, "data/natives/plants.json");
const registrationPath = path.join(root, "data/natives/bonap-county-map-registration.json");
const reviewsPath = path.join(root, "data/natives/bonap-county-map-reviews.json");
const mapKeyUrl = "http://bonap.org/MapKey.html";

const MAP_COLORS = Object.freeze({
  "0,255,0": "Native",
  "0,128,0": "Native State Only",
  "255,255,0": "Native Rare",
  "255,165,0": "Native Historic",
  "0,191,0": "Adventive",
  "173,142,0": "Unreported",
  "169,169,169": "False/Unverified/Cultivated",
  "0,0,0": "Exotic",
  "0,0,255": "Exotic State Only",
  "0,255,255": "Exotic County",
  "0,191,191": "Native Adventive",
  "255,0,0": "Native Extinct",
  "255,0,255": "Noxious",
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function decodePngRgba(bytes) {
  const buffer = Buffer.from(bytes);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const imageData = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      imageData.push(data);
    }
    offset += length + 12;
    if (type === "IEND") break;
  }
  if (width !== 1052 || height !== 642 || bitDepth !== 8 || colorType !== 6) {
    throw new Error("BONAP county map must be an 8-bit RGBA 1052x642 PNG");
  }
  const inflated = inflateSync(Buffer.concat(imageData));
  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel;
  const pixels = Buffer.alloc(height * rowBytes);
  let sourceOffset = 0;
  const paeth = (a, b, c) => {
    const estimate = a + b - c;
    const pa = Math.abs(estimate - a);
    const pb = Math.abs(estimate - b);
    const pc = Math.abs(estimate - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = inflated[sourceOffset++];
    const row = pixels.subarray(y * rowBytes, (y + 1) * rowBytes);
    const previous = y === 0 ? null : pixels.subarray((y - 1) * rowBytes, y * rowBytes);
    for (let index = 0; index < rowBytes; index++) {
      let value = inflated[sourceOffset++];
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      const above = previous ? previous[index] : 0;
      const upperLeft = previous && index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
      if (filter === 1) value = (value + left) & 0xff;
      else if (filter === 2) value = (value + above) & 0xff;
      else if (filter === 3) value = (value + Math.floor((left + above) / 2)) & 0xff;
      else if (filter === 4) value = (value + paeth(left, above, upperLeft)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      row[index] = value;
    }
  }
  return { width, height, pixels };
}

export function projectCounty(registration, countyFips) {
  const point = registration.counties[countyFips];
  if (!point) throw new Error(`No BONAP registration point for county ${countyFips}`);
  const [projectedX, projectedY] = proj4(
    "+proj=longlat +datum=WGS84",
    registration.projection.proj4,
    [point.longitude, point.latitude],
  );
  const affine = registration.projection.affine;
  return {
    x: affine[0] * projectedX + affine[1] * projectedY + affine[2],
    y: affine[3] * projectedX + affine[4] * projectedY + affine[5],
  };
}

function pixelColor(image, x, y) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
  const offset = (y * image.width + x) * 4;
  return `${image.pixels[offset]},${image.pixels[offset + 1]},${image.pixels[offset + 2]}`;
}

function modalFillColor(image, center, radius) {
  const counts = new Map();
  const x = Math.round(center.x);
  const y = Math.round(center.y);
  for (let row = y - radius; row <= y + radius; row++) {
    for (let column = x - radius; column <= x + radius; column++) {
      const color = pixelColor(image, column, row);
      if (!color || !Object.hasOwn(MAP_COLORS, color)) continue;
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  if (ranked.length === 0) return null;
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);
  const [color, count] = ranked[0];
  return { color, category: MAP_COLORS[color], share: count / total };
}

export function classifyCounty(image, center, sampling) {
  const samples = sampling.radii.map((radius) => modalFillColor(image, center, radius));
  const byCategory = new Map();
  for (const sample of samples) {
    if (!sample) continue;
    const entry = byCategory.get(sample.category) ?? { category: sample.category, count: 0, samples: [] };
    entry.count++;
    entry.samples.push(sample);
    byCategory.set(sample.category, entry);
  }
  const stable = [...byCategory.values()].sort((left, right) => right.count - left.count)[0];
  if (!stable || stable.count < sampling.requiredStableRadii) return null;
  if (stable.samples.some((sample) => sample.share < sampling.minimumModalShare)) return null;
  return {
    rawCategory: stable.category,
    color: stable.samples[stable.samples.length - 1].color,
    stableRadii: stable.count,
    modalShares: stable.samples.map((sample) => sample.share),
  };
}

function buildReview({ map, plant, image, registration, reviewedAt }) {
  const counties = [];
  const diagnostics = [];
  for (const countyFips of Object.keys(registration.counties).sort()) {
    const center = projectCounty(registration, countyFips);
    const conversion = classifyCounty(image, center, registration.sampling);
    if (!conversion) {
      diagnostics.push({ countyFips, status: "unstable" });
      continue;
    }
    counties.push({ countyFips, rawCategory: conversion.rawCategory });
    diagnostics.push({ countyFips, ...conversion });
  }
  if (counties.length === 0) return { review: null, diagnostics };
  return {
    review: {
      plantId: plant.id,
      scientificName: plant.scientificName,
      mapUrl: map.mapUrl,
      mapSha256: map.sha256,
      mapGenerationDateFromContent: null,
      taxonomyMatch: "exact",
      mapScopeDecision: "confirmed_taxon_scope",
      reviewStatus: "approved",
      currentStatusConfirmed: true,
      reviewer: "codex-bonap-raster-review",
      reviewedAt,
      reviewNote:
        `Current-hash BONAP county PNG inspected against the linked MapKey ${mapKeyUrl}. ` +
        `Registered-county colors were converted with the registered Census 2010 ` +
        `largest-part centroid and stable modal fill sampling at radii ` +
        `${registration.sampling.radii.join(", ")}; line and uncertain colors are excluded. ` +
        `Only stable registered-county conversions are included; omitted counties remain unreviewed. ` +
        `Map generation date was not machine-readable from PNG metadata and remains null.`,
      counties,
    },
    diagnostics,
  };
}

export function buildBonapAffectedCountyReviews({ ingestion, plants, registration, reviewedAt }) {
  const plantsById = plants.plants ?? plants;
  const mappings = new Map((ingestion.bonap.mapMappings ?? []).map((mapping) => [mapping.mapSha256, mapping]));
  const reviews = [];
  const diagnostics = [];
  for (const map of ingestion.bonap.mapSnapshots ?? []) {
    const mapping = mappings.get(map.sha256);
    const plant = mapping ? plantsById[mapping.plantId] : null;
    if (!plant || mapping.mapStatus !== "exact" || mapping.mapUrl !== map.mapUrl) continue;
    const image = decodePngRgba(fs.readFileSync(path.join(root, map.assetPath)));
    const result = buildReview({ map, plant, image, registration, reviewedAt });
    diagnostics.push({
      plantId: plant.id,
      mapSha256: map.sha256,
      convertedCountyCount: result.review?.counties.length ?? 0,
      unstableCountyCount: result.diagnostics.filter((row) => row.status === "unstable").length,
      categories: Object.fromEntries(
        Object.entries(Object.groupBy(result.review?.counties ?? [], (row) => row.rawCategory))
          .map(([category, rows]) => [category, rows.length]),
      ),
    });
    if (result.review) reviews.push(result.review);
  }
  return { reviews, diagnostics };
}

function mergeReviews(existing, generated) {
  const generatedKeys = new Set(generated.map((review) => [review.plantId, review.mapUrl, review.mapSha256].join("|")));
  const retained = (existing.records ?? []).filter(
    (review) => !generatedKeys.has([review.plantId, review.mapUrl, review.mapSha256].join("|")),
  );
  return {
    ...existing,
    provenance:
      `${existing.provenance} Deterministic registered-county conversions are generated by ` +
      `scripts/review-bonap-county-maps.mjs from the registered Census centroid artifact; ` +
      `unstable raster samples remain omitted.`,
    records: [...retained, ...generated].sort((left, right) =>
      `${left.plantId}|${left.mapSha256}`.localeCompare(`${right.plantId}|${right.mapSha256}`),
    ),
  };
}

export function main() {
  const ingestion = readJson(ingestionPath);
  const plants = readJson(plantsPath);
  const registration = readJson(registrationPath);
  const existing = readJson(reviewsPath);
  const reviewedAt = process.env.BONAP_REVIEWED_AT ?? new Date().toISOString();
  const { reviews, diagnostics } = buildBonapAffectedCountyReviews({
    ingestion,
    plants,
    registration,
    reviewedAt,
  });
  const output = mergeReviews(existing, reviews);
  const categoryCounts = Object.groupBy(
    reviews.flatMap((review) => review.counties),
    (county) => county.rawCategory,
  );
  console.log(JSON.stringify({
    generatedReviewCount: reviews.length,
    generatedCountyConversionCount: reviews.reduce((sum, review) => sum + review.counties.length, 0),
    categoryCounts: Object.fromEntries(Object.entries(categoryCounts).map(([key, value]) => [key, value.length])),
    unstableCountySamples: diagnostics.reduce((sum, row) => sum + row.unstableCountyCount, 0),
    outputRecordCount: output.records.length,
  }, null, 2));
  if (process.argv.includes("--write")) {
    fs.writeFileSync(reviewsPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`wrote ${reviewsPath}`);
  }
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
