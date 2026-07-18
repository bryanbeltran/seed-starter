import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { validateCatalog } from "./catalog/lib/validate.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "data/catalog/crops.json");

if (!fs.existsSync(catalogPath)) {
  console.error("Missing data/catalog/crops.json — run: pnpm run etl:catalog -- --write");
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const errors = validateCatalog(catalog);

if (errors.length) {
  console.error("Catalog validation failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const crops = Object.keys(catalog.crops).length;
const varieties = Object.values(catalog.crops).reduce(
  (n, c) => n + Object.keys(c.varieties ?? {}).length,
  0,
);
console.log(`Catalog OK: ${crops} crops, ${varieties} varieties`);
