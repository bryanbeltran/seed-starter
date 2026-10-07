import { createHash } from "node:crypto";
import { matchScientificName } from "./native-taxonomy.mjs";

export const NPIN_URLS = Object.freeze({
  autocomplete: "https://www.wildflower.org/plants/autocomplete-data.php",
  profile: "https://www.wildflower.org/plants/result.php",
});

const FIELD_ALIASES = new Map([
  ["distribution", "distribution"],
  ["native distribution", "nativeDistribution"],
  ["native habitat", "nativeHabitat"],
  ["bloom time", "bloomTime"],
  ["benefit", "benefit"],
  ["value to wildlife", "wildlifeValue"],
  ["height", "height"],
  ["light requirement", "lightRequirement"],
  ["soil moisture", "soilMoisture"],
  ["soil p h", "soilPh"],
]);

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function toText(html) {
  return decodeHtml(String(html ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|dt|dd|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export function parseNpinAutocomplete(payload) {
  let rows = payload;
  if (typeof payload === "string") {
    try {
      rows = JSON.parse(payload);
    } catch {
      throw new Error("NPIN autocomplete response was not valid JSON");
    }
  }
  if (!Array.isArray(rows)) throw new Error("NPIN autocomplete response was not an array");
  return rows.map((row, index) => {
    const value = row?.value;
    if (!["cn", "sn", "genus", "value"].every((key) => typeof row?.[key] === "string")) {
      throw new Error(`NPIN autocomplete row ${index} omitted cn, sn, genus, or value`);
    }
    return {
      commonName: row.cn,
      scientificName: row.sn,
      genus: row.genus,
      npinId: value,
      evidenceUse: "taxon_crosswalk_only",
    };
  });
}

export function matchNpinTaxon(scientificName, autocompleteRows) {
  return matchScientificName(scientificName, autocompleteRows, (row) => row.scientificName);
}

export function isNpinChallenge(status, html) {
  const text = String(html ?? "");
  return (
    [403, 429, 503].includes(Number(status)) && /cloudflare|cf-chl-|challenge-platform/i.test(text) ||
    /<title>\s*(just a moment|attention required|security check)/i.test(text) ||
    /cf-browser-verification|challenge-platform|cf-chl-/i.test(text)
  );
}

function labelKey(label) {
  return toText(label).replace(/\s*:\s*$/, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Parse only labeled profile enrichment fields; no field is treated as county nativity. */
export function parseNpinProfileFields(html) {
  const source = String(html ?? "");
  const fields = {};
  const add = (label, value) => {
    const key = FIELD_ALIASES.get(labelKey(label));
    const text = toText(value);
    if (key && text) fields[key] = text;
  };

  for (const match of source.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)) {
    add(match[1], match[2]);
  }
  for (const match of source.matchAll(/<tr\b[^>]*>\s*<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    add(match[1], match[2]);
  }
  for (const match of source.matchAll(/<tr\b[^>]*>\s*<td\b[^>]*class=["'][^"']*(?:label|term)[^"']*["'][^>]*>([\s\S]*?)<\/td>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    add(match[1], match[2]);
  }

  return {
    fields,
    evidenceUse: "profile_enrichment_only",
    nativityResolution: "none",
  };
}

function allowedNpinHost(url) {
  return url.hostname === "wildflower.org" || url.hostname === "www.wildflower.org";
}

function approvedNpinUrl(value, description) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !allowedNpinHost(url) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error(`${description} URL is outside the approved HTTPS wildflower.org hosts: ${url.href}`);
  }
  return url;
}

async function fetchNpinResponse(url, options, fetchImpl, description) {
  const requestUrl = approvedNpinUrl(url, description);
  const response = await fetchImpl(requestUrl, { ...options, redirect: "manual" });
  if (response.url) {
    const responseUrl = approvedNpinUrl(response.url, `${description} response`);
    if (responseUrl.origin !== requestUrl.origin) {
      throw new Error(`${description} response escaped its approved source host: ${response.url}`);
    }
  }
  if (response.status >= 300 && response.status < 400 && response.status !== 304) {
    const location = response.headers?.get?.("location");
    if (location) {
      const redirectUrl = approvedNpinUrl(new URL(location, requestUrl), `${description} redirect target`);
      throw new Error(`${description} redirect was not followed during source refresh: ${redirectUrl.href}`);
    }
    throw new Error(`${description} redirect was not followed during source refresh`);
  }
  return response;
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchNpinResponse(url, {
    headers: { accept: "application/json,text/plain,*/*" },
  }, fetchImpl, "NPIN autocomplete");
  if (!response.ok) throw new Error(`NPIN autocomplete failed (${response.status}): ${url}`);
  let payload;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    throw new Error(`NPIN autocomplete response was not valid JSON: ${url}`);
  }
  return { payload, response };
}

async function fetchProfile(profileUrl, fetchImpl) {
  const response = await fetchNpinResponse(profileUrl, {
    headers: { accept: "text/html" },
  }, fetchImpl, "NPIN profile");
  const html = await response.text();
  if (isNpinChallenge(response.status, html)) {
    return { status: "challenge", httpStatus: response.status, html, response };
  }
  if (!response.ok) throw new Error(`NPIN profile failed (${response.status}): ${profileUrl}`);
  return { status: "available", httpStatus: response.status, html, response };
}

export async function fetchNpinEnrichment({
  plants,
  fetchImpl = fetch,
  now = new Date(),
  onPlant = () => {},
}) {
  const retrievedAt = now.toISOString();
  const enrichments = [];
  for (const plant of Object.values(plants)) {
    const autocompleteUrl = new URL(NPIN_URLS.autocomplete);
    autocompleteUrl.searchParams.set("q", plant.scientificName);
    const { payload, response: autocompleteResponse } = await fetchJson(autocompleteUrl, fetchImpl);
    const autocompleteRows = parseNpinAutocomplete(payload);
    const match = matchNpinTaxon(plant.scientificName, autocompleteRows);
    const autocompleteMarkers = {
      autocompleteUrl: autocompleteUrl.href,
      autocompleteEtag: autocompleteResponse.headers?.get?.("etag") ?? null,
      autocompleteLastModified: autocompleteResponse.headers?.get?.("last-modified") ?? null,
    };
    if (match.status !== "exact") {
      enrichments.push({
        plantId: plant.id,
        scientificName: plant.scientificName,
        matchStatus: match.status,
        ...autocompleteMarkers,
        autocompleteMatchCount: match.matches.length,
        profileStatus: "not_attempted",
        evidenceUse: "crosswalk_only",
        retrievedAt,
      });
      onPlant({ plantId: plant.id, status: match.status });
      continue;
    }

    const matchRow = match.matches[0];
    if (!/^[A-Za-z0-9_-]+$/.test(matchRow.npinId)) {
      throw new Error(`NPIN autocomplete returned an invalid profile ID for ${plant.id}`);
    }
    const profileUrl = new URL(NPIN_URLS.profile);
    profileUrl.searchParams.set("id_plant", matchRow.npinId);
    const profile = await fetchProfile(profileUrl, fetchImpl);
    const profileHash = createHash("sha256").update(profile.html).digest("hex");
    const parsed = profile.status === "available"
      ? parseNpinProfileFields(profile.html)
      : { fields: null, evidenceUse: "profile_unavailable", nativityResolution: "none" };
    enrichments.push({
      plantId: plant.id,
      scientificName: plant.scientificName,
      matchStatus: "exact",
      autocomplete: matchRow,
      ...autocompleteMarkers,
      profileUrl: profileUrl.href,
      profileStatus: profile.status,
      profileHttpStatus: profile.httpStatus,
      profileSha256: profileHash,
      profileEtag: profile.response.headers?.get?.("etag") ?? null,
      profileLastModified: profile.response.headers?.get?.("last-modified") ?? null,
      fields: parsed.fields,
      evidenceUse: parsed.evidenceUse,
      nativityResolution: parsed.nativityResolution,
      retrievedAt,
    });
    onPlant({ plantId: plant.id, status: profile.status });
  }
  return { sourceId: "npin", retrievedAt, enrichments };
}
