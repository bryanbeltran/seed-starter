const ZIP_RE = /^\d{5}$/;

export class ZoneLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZoneLookupError";
  }
}

export function normalizeZip(zip: string): string {
  const digits = zip.trim().replace(/\D/g, "");
  if (!ZIP_RE.test(digits)) {
    throw new ZoneLookupError("Enter a valid 5-digit US ZIP code.");
  }
  return digits;
}

type PhzmResponse = { zone?: string; error?: string };

export async function zipToZone(zip: string): Promise<string> {
  const normalized = normalizeZip(zip);
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

  return zone;
}
