import { resolveLocation } from "./resolveLocation";

export class ZoneLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZoneLookupError";
  }
}

const ZIP_RE = /^\d{5}$/;

export function normalizeZip(zip: string): string {
  const digits = zip.trim().replace(/\D/g, "");
  if (!ZIP_RE.test(digits)) {
    throw new ZoneLookupError("Enter a valid 5-digit US ZIP code.");
  }
  return digits;
}

/** @deprecated Use resolveLocation */
export async function zipToZone(zip: string): Promise<string> {
  const { zone } = await resolveLocation(zip);
  return zone;
}
