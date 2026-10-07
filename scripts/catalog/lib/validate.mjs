import { findJunkCrops } from "./cropResolve.mjs";

const HTML_ENTITY_PATTERN = /&(?:#(?:x[0-9a-f]+|[0-9]+)|[a-z][a-z0-9]+);/i;

export function validateCatalog(catalog) {
  const errors = [];
  const { crops } = catalog;
  if (!crops || typeof crops !== "object") {
    errors.push("catalog.crops missing");
    return errors;
  }

  errors.push(...findJunkCrops(crops));

  const cropEntries = Object.entries(crops);
  if (cropEntries.length < 30) {
    errors.push(`expected >= 30 crops, got ${cropEntries.length}`);
  }

  let varieties = 0;
  for (const [cropId, crop] of cropEntries) {
    if (crop.id !== cropId) errors.push(`${cropId}: id mismatch`);
    if (!crop.name) errors.push(`${cropId}: missing name`);
    if (HTML_ENTITY_PATTERN.test(crop.name)) {
      errors.push(`${cropId}: crop name contains an undecoded HTML entity`);
    }
    if (!["transplant", "direct"].includes(crop.method)) {
      errors.push(`${cropId}: invalid method`);
    }
    if (!crop.daysToHarvest || crop.daysToHarvest < 10 || crop.daysToHarvest > 400) {
      errors.push(`${cropId}: invalid daysToHarvest`);
    }
    if (!crop.seasons?.spring) errors.push(`${cropId}: missing seasons.spring`);
    if (crop.seasons?.spring && crop.seasons.spring.anchor !== "lastSpringFrost") {
      errors.push(`${cropId}: seasons.spring.anchor must be lastSpringFrost`);
    }
    if (crop.seasons?.fall && crop.seasons.fall.anchor !== "firstFallFrost") {
      errors.push(`${cropId}: seasons.fall.anchor must be firstFallFrost`);
    }
    if (crop.seasons?.summer && crop.seasons.summer.anchor !== "lastSpringFrost") {
      errors.push(`${cropId}: seasons.summer.anchor must be lastSpringFrost`);
    }
    const vars = Object.values(crop.varieties ?? {});
    varieties += vars.length;
    for (const v of vars) {
      if (!v.name) errors.push(`${cropId}/${v.id}: missing variety name`);
      if (HTML_ENTITY_PATTERN.test(v.name)) {
        errors.push(`${cropId}/${v.id}: variety name contains an undecoded HTML entity`);
      }
      if (!v.source) errors.push(`${cropId}/${v.id}: missing source`);
      if (!v.sourceUrl) errors.push(`${cropId}/${v.id}: missing sourceUrl`);
    }
  }

  if (varieties < 1000) {
    errors.push(`expected >= 1000 varieties, got ${varieties}`);
  }
  if (varieties < 2000) {
    errors.push(`expected >= 2000 varieties, got ${varieties}`);
  }

  return errors;
}
