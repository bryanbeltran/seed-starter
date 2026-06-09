import zipZones from "../../data/zipZones.json";
import phzmZones from "../../data/zipZones-phzm.json";
import { normalizeZip, ZoneLookupError } from "./zipToZone";

const fixtureZones: Record<string, string> = zipZones;
const bundledPhzm: Record<string, string> = phzmZones;

type PhzmResponse = { zone?: string; error?: string };

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

  const data = (await res.json()) as PhzmResponse;
  const zone = data.zone?.toLowerCase();
  if (!zone) {
    throw new ZoneLookupError(`No hardiness zone found for ZIP ${normalized}.`);
  }

  return { zip: normalized, zone, source: "phzm" };
}
