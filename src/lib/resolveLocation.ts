import zipZones from "../../data/zipZones.json";
import phzmZones from "../../data/zipZones-phzm.json";
import { normalizeZip, ZoneLookupError } from "./zipToZone";

const fixtureZones: Record<string, string> = zipZones;
const bundledPhzm: Record<string, string> = phzmZones;

export type ResolvedLocation = {
  zip: string;
  zone: string;
  source: "fixture" | "phzm";
};

export async function resolveLocation(zip: string): Promise<ResolvedLocation> {
  const normalized = normalizeZip(zip);

  const fixtureZone = fixtureZones[normalized];
  if (fixtureZone) {
    return { zip: normalized, zone: fixtureZone.toLowerCase(), source: "fixture" };
  }

  const bundledZone = bundledPhzm[normalized];
  if (bundledZone) {
    return { zip: normalized, zone: bundledZone.toLowerCase(), source: "phzm" };
  }

  const res = await fetch(`https://phzmapi.org/${normalized}.json`, {
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    throw new ZoneLookupError(`No hardiness zone found for ZIP ${normalized}.`);
  }

  const data: unknown = await res.json();
  // Validate the external payload before allowing it into frost calculations.
  const zone =
    data !== null && typeof data === "object" && "zone" in data &&
    typeof data.zone === "string"
      ? data.zone.toLowerCase()
      : undefined;
  if (!zone || !/^(?:[1-9]|1[0-3])[ab]$/.test(zone)) {
    throw new ZoneLookupError(`No hardiness zone found for ZIP ${normalized}.`);
  }

  return { zip: normalized, zone, source: "phzm" };
}
