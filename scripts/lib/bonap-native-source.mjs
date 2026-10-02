import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { matchScientificName, normalizeScientificName } from "./native-taxonomy.mjs";

export const BONAP_URLS = Object.freeze({
  fullTaxonList: "https://bonap.net/TDC/Query/FullTaxonList",
  speciesList: "https://bonap.net/TDC/Query/SpeciesList",
  parentForTaxon: "https://bonap.net/TDC/Query/ParentForTaxon",
  taxonDetails: "https://bonap.net/TDC/Query/TaxonDetails",
  napaGenusCounty: "https://bonap.net/Napa/TaxonMaps/Genus/County/",
  mapGallery: "https://bonap.net/MapGallery/County/",
  mapKey: "http://bonap.org/MapKey.html",
});

// The verified 2026-10-01 UTF-8 response was 1,399,603 bytes. Without a
// publisher checksum, any size change requires a reviewed completeness baseline.
export const BONAP_FULL_TAXON_LIST_VERIFIED_BYTES = 1_399_603;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_MAX_DECODED_BYTES = 64 * 1024 * 1024;
const PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});
const BONAP_ALLOWED_HOSTS = new Set(["bonap.net", "www.bonap.net"]);
const LOWER48_FIPS_PREFIXES = new Set([
  "01", "04", "05", "06", "08", "09", "10", "12", "13", "16", "17", "18",
  "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
  "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42",
  "44", "45", "46", "47", "48", "49", "50", "51", "53", "54", "55", "56",
]);
const STATE_CODE_BY_FIPS = new Map([
  ["01", "AL"], ["04", "AZ"], ["05", "AR"], ["06", "CA"], ["08", "CO"],
  ["09", "CT"], ["10", "DE"], ["12", "FL"], ["13", "GA"], ["16", "ID"],
  ["17", "IL"], ["18", "IN"], ["19", "IA"], ["20", "KS"], ["21", "KY"],
  ["22", "LA"], ["23", "ME"], ["24", "MD"], ["25", "MA"], ["26", "MI"],
  ["27", "MN"], ["28", "MS"], ["29", "MO"], ["30", "MT"], ["31", "NE"],
  ["32", "NV"], ["33", "NH"], ["34", "NJ"], ["35", "NM"], ["36", "NY"],
  ["37", "NC"], ["38", "ND"], ["39", "OH"], ["40", "OK"], ["41", "OR"],
  ["42", "PA"], ["44", "RI"], ["45", "SC"], ["46", "SD"], ["47", "TN"],
  ["48", "TX"], ["49", "UT"], ["50", "VT"], ["51", "VA"], ["53", "WA"],
  ["54", "WV"], ["55", "WI"], ["56", "WY"],
]);

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function value(object, ...keys) {
  for (const key of keys) if (object?.[key] != null) return object[key];
  return undefined;
}

async function request(url, options = {}, fetchImpl = fetch) {
  const requestUrl = new URL(url);
  if (
    requestUrl.protocol !== "https:" ||
    !BONAP_ALLOWED_HOSTS.has(requestUrl.hostname) ||
    requestUrl.username ||
    requestUrl.password ||
    requestUrl.port
  ) {
    throw new Error(`BONAP request rejected URL outside the approved HTTPS host: ${requestUrl.href}`);
  }
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetchImpl(requestUrl, { ...options, redirect: "manual" });
      if (response.url) {
        const responseUrl = new URL(response.url);
        if (
          responseUrl.protocol !== "https:" ||
          !BONAP_ALLOWED_HOSTS.has(responseUrl.hostname) ||
          responseUrl.username ||
          responseUrl.password ||
          responseUrl.port ||
          responseUrl.origin !== requestUrl.origin
        ) {
          throw new Error(`BONAP request failed (200): response URL escaped the approved source host: ${response.url}`);
        }
      }
      if (response.status >= 300 && response.status < 400 && response.status !== 304) {
        const location = response.headers?.get?.("location");
        if (location) {
          const redirectUrl = new URL(location, requestUrl);
          if (
            redirectUrl.protocol !== "https:" ||
            !BONAP_ALLOWED_HOSTS.has(redirectUrl.hostname) ||
            redirectUrl.username ||
            redirectUrl.password ||
            redirectUrl.port
          ) {
            throw new Error(`BONAP request failed (${response.status}): redirect target outside the approved HTTPS host was rejected: ${redirectUrl.href}`);
          }
        }
        throw new Error(`BONAP request failed (${response.status}): redirects are not followed during source refresh`);
      }
      if (response.ok) return response;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 3) {
        throw new Error(`BONAP request failed (${response.status}): ${url}`);
      }
      const retryAfter = Number(response.headers?.get?.("retry-after")) || 0;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(retryAfter * 1000, 250 * 2 ** attempt)),
      );
    } catch (error) {
      lastError = error;
      if (attempt === 3 || String(error?.message).includes("BONAP request failed (")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
  throw lastError ?? new Error(`BONAP request failed: ${url}`);
}

async function mapLimit(values, concurrency, operation) {
  const output = new Array(values.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      output[index] = await operation(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return output;
}

/** Parse the cited FullTaxonList TSV; it has names but no stable ID column. */
export function parseBonapFullTaxonList(text) {
  const taxa = [];
  let firstContentRow = true;
  for (const line of String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const columns = line.split("\t").map((column) => column.trim());
    if (firstContentRow && /^BONAP\b.*\t2014(?:\t|$)/i.test(line)) {
      firstContentRow = false;
      continue;
    }
    firstContentRow = false;
    if (
      columns.length === 3 &&
      /^family$/i.test(columns[0]) &&
      /^genus$/i.test(columns[1]) &&
      /^scientific name$/i.test(columns[2])
    ) {
      continue;
    }
    if (columns.length !== 3) {
      throw new Error("BONAP FullTaxonList contains a malformed non-TSV row");
    }
    const [family, genus, scientificName] = columns;
    if (!family || !genus || !scientificName || !/^[A-Z][a-z-]+$/.test(genus)) {
      throw new Error("BONAP FullTaxonList contains a malformed taxon row");
    }
    taxa.push({ family, genus, scientificName });
  }
  return taxa;
}

function assertNoPreviouslyListedTaxaOmitted(taxa, previousTaxa) {
  const counts = new Map();
  for (const taxon of taxa) {
    const name = normalizeScientificName(taxon.scientificName);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  for (const taxon of previousTaxa) {
    const name = normalizeScientificName(taxon.scientificName);
    const remaining = counts.get(name) ?? 0;
    if (remaining === 0) {
      throw new Error(`BONAP FullTaxonList omitted previously listed taxon ${taxon.scientificName}`);
    }
    counts.set(name, remaining - 1);
  }
}

/** TDC list membership is presence only. The parser deliberately drops status fields. */
export function parseBonapSpeciesList(response, countyFips) {
  if (!/^\d{5}$/.test(countyFips ?? "")) throw new Error("BONAP county FIPS must be five digits");
  const data = response?.data ?? response;
  const taxonList = Array.isArray(data) ? data : data?.TaxonList ?? data?.taxonList;
  if (!Array.isArray(taxonList)) throw new Error("BONAP SpeciesList response omitted TaxonList");
  return taxonList.map((row, index) => {
    const id = value(row, "Id", "id");
    const name = value(row, "Name", "name");
    if ((typeof id !== "number" && typeof id !== "string") || !String(id).trim() || !String(name ?? "").trim()) {
      throw new Error(`BONAP SpeciesList TaxonList[${index}] omitted Id or Name`);
    }
    return {
      countyFips,
      bonapTaxonId: String(id),
      scientificName: String(name).trim(),
      evidenceUse: "presence_only",
    };
  });
}

// SpeciesList's description count excludes infraspecific rows, which remain useful presence data.
const INFRASPECIFIC_RANK_MARKER = /(?:^|\s)(?:subsp\.?|ssp\.?|subspecies|var\.?|variety|varietas|subvar\.?|f\.?|forma|subf\.?|nothosubsp\.?|nothossp\.?|nothovar\.?)\s/i;

function speciesAndNothospeciesRowCount(taxa) {
  return taxa.filter((taxon) => !INFRASPECIFIC_RANK_MARKER.test(taxon.scientificName)).length;
}

function speciesAndNothospeciesCount(response) {
  const description = response?.data?.DescriptionText ?? response?.DescriptionText ?? "";
  const text = String(description).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const match = text.match(/\btotal of\s+([\d,]+)\s+.*?species and nothospecies\b/i);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function tdcAjaxHeaders(accept) {
  return {
    accept,
    "x-requested-with": "XMLHttpRequest",
    referer: "https://bonap.net/TDC/Query",
  };
}

function tdcQueryForm({
  countyFips = "",
  page = "-1",
  familyId = "",
  genusId = "",
  speciesId = "",
  lastSelectedRank = "",
}) {
  const state = countyFips ? STATE_CODE_BY_FIPS.get(countyFips.slice(0, 2)) : "";
  if (countyFips && !state) throw new Error(`BONAP county FIPS has no lower-48 state code: ${countyFips}`);
  return new URLSearchParams({
    synonymMode: "1",
    authorMode: "1",
    commonNameMode: "1",
    taxonPerPage: "10000",
    selectedSpeciesPage: page,
    selectedGenusPage: "0",
    familyId,
    genusId,
    speciesId,
    state,
    selectedAttributes: ";",
    zipCodeSearch: "",
    locationName: "",
    fipsCodeSearch: countyFips,
    familyKeys: ";",
    pictureListType: "Hidden",
    selectedPicturePage: "0",
    lastSelectedRank,
    familyType: "0",
  });
}

async function parseTdcJson(response, description) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${description} returned invalid JSON`);
  }
}

/** Pull only the continental nativity descriptor; it is never a county claim. */
export function parseBonapTaxonDetails(response, expectedId, expectedName) {
  if (typeof response === "string") {
    const header = response.match(/<div\b[^>]*id=["']speciesHeader["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const headerName = header?.split(/<span\b/i, 1)[0]?.replace(/<[^>]*>/g, " ").trim();
    if (!headerName || normalizeScientificName(headerName) !== normalizeScientificName(expectedName)) {
      throw new Error(`BONAP TaxonDetails name does not match SpeciesList taxon ${expectedName}`);
    }
    const countyMapBlock = response.match(/<div\b[^>]*id=["']countyMap["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
    const countyMapSource = countyMapBlock.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1];
    const countyOccurrenceMapUrl = countyMapSource
      ? new URL(decodeHtml(countyMapSource), "https://bonap.net").href
      : null;
    if (countyOccurrenceMapUrl) {
      const map = new URL(countyOccurrenceMapUrl);
      if (map.hostname !== "bonap.net" || !map.pathname.startsWith("/MapGallery/County/")) {
        throw new Error(`BONAP TaxonDetails returned a non-county occurrence map for ${expectedName}`);
      }
    }
    const continentalMatch = response.match(
      /<div\b[^>]*>\s*Nativity\s*<\/div>\s*<div\b[^>]*>\s*Continental\s*<\/div>\s*<div\b[^>]*>([\s\S]*?)<\/div>/i,
    );
    return {
      bonapTaxonId: String(expectedId),
      scientificName: headerName,
      continentalNativity: continentalMatch?.[1]?.replace(/<[^>]*>/g, " ").trim() || null,
      countyOccurrenceMapCount: countyOccurrenceMapUrl ? 1 : 0,
      countyOccurrenceMapUrl,
      evidenceUse: "identity_and_occurrence_only",
    };
  }
  const details = response?.Taxon ?? response?.taxon ?? response?.TaxonDetails ?? response;
  const id = value(details, "Id", "id");
  const name = value(details, "Name", "name", "ScientificName", "scientificName");
  if (id != null && String(id) !== String(expectedId)) {
    throw new Error(`BONAP TaxonDetails returned a different source taxon ID for ${expectedId}`);
  }
  if (!name || normalizeScientificName(name) !== normalizeScientificName(expectedName)) {
    throw new Error(`BONAP TaxonDetails name does not match SpeciesList taxon ${expectedName}`);
  }
  return {
    bonapTaxonId: String(expectedId),
    scientificName: String(name).trim(),
    continentalNativity: value(details, "Nativity Continental Native", "nativityContinentalNative") ?? null,
    countyOccurrenceMapCount: Array.isArray(value(details, "CountyMaps", "countyMaps", "VerifiedCountyMaps"))
      ? value(details, "CountyMaps", "countyMaps", "VerifiedCountyMaps").length
      : null,
    countyOccurrenceMapUrl: null,
    evidenceUse: "identity_and_occurrence_only",
  };
}

export function matchBonapTaxon(scientificName, taxa) {
  return matchScientificName(scientificName, taxa, (taxon) => taxon.scientificName);
}

export function parseNapaTaxonMapLink(html, pageUrl, scientificName) {
  const baseUrl = new URL(pageUrl);
  const links = [];
  for (const match of String(html ?? "").matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[2]);
    let url;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== "bonap.net" ||
      !url.pathname.startsWith("/MapGallery/County/") ||
      !url.pathname.toLowerCase().endsWith(".png")
    ) {
      continue;
    }
    const mapTaxonName = decodeURIComponent(url.pathname.slice("/MapGallery/County/".length, -4));
    if (normalizeScientificName(mapTaxonName) !== normalizeScientificName(scientificName)) continue;
    links.push(url.href);
  }
  const unique = [...new Set(links)];
  if (unique.length === 1) return { status: "exact", url: unique[0] };
  return { status: unique.length > 1 ? "ambiguous" : "unresolved", url: null };
}

function pngTextChunks(bytes) {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return [];
  const texts = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) break;
    const data = buffer.subarray(dataStart, dataEnd);
    if (type === "tEXt") {
      const separator = data.indexOf(0);
      if (separator >= 0) texts.push(data.subarray(separator + 1).toString("latin1"));
    } else if (type === "iTXt") {
      const separator = data.indexOf(0);
      if (separator >= 0) {
        const payload = data.subarray(separator + 1);
        const compressed = payload[0] === 1;
        let cursor = 2;
        for (let field = 0; field < 2; field++) {
          const end = payload.indexOf(0, cursor);
          if (end < 0) break;
          cursor = end + 1;
        }
        if (cursor <= payload.length) {
          try {
            const text = payload.subarray(cursor);
            texts.push((compressed ? inflateSync(text) : text).toString("utf8"));
          } catch {
            // An unreadable optional PNG text chunk does not invalidate the image.
          }
        }
      }
    } else if (type === "zTXt") {
      const separator = data.indexOf(0);
      if (separator >= 0 && data[separator + 1] === 0) {
        try {
          texts.push(inflateSync(data.subarray(separator + 2)).toString("latin1"));
        } catch {
          // Keep date unavailable when optional source metadata cannot be decoded.
        }
      }
    }
    offset = dataEnd + 4;
    if (type === "IEND") break;
  }
  return texts;
}

function pngExpectedImageDataLength(width, height, bitsPerPixel, interlaceMethod) {
  const passes = interlaceMethod === 0
    ? [[0, 0, 1, 1]]
    : [
        [0, 0, 8, 8],
        [4, 0, 8, 8],
        [0, 4, 4, 8],
        [2, 0, 4, 4],
        [0, 2, 2, 4],
        [1, 0, 2, 2],
        [0, 1, 1, 2],
      ];
  let length = 0;
  for (const [startX, startY, stepX, stepY] of passes) {
    const passWidth = width <= startX ? 0 : Math.ceil((width - startX) / stepX);
    const passHeight = height <= startY ? 0 : Math.ceil((height - startY) / stepY);
    if (passWidth === 0 || passHeight === 0) continue;
    const rowBytes = Math.ceil((passWidth * bitsPerPixel) / 8);
    length += passHeight * (rowBytes + 1);
  }
  return length;
}

/** Reject incomplete or corrupt PNG bodies before they can enter a staged snapshot. */
export function assertValidBonapCountyMapPng(bytes) {
  const buffer = Buffer.from(bytes);
  const invalid = (reason) => {
    throw new Error(`BONAP county map PNG is invalid: ${reason}`);
  };
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    invalid("signature is missing or truncated");
  }

  let offset = PNG_SIGNATURE.length;
  let chunkCount = 0;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  let hasHeader = false;
  let hasPalette = false;
  let hasImageData = false;
  let imageDataEnded = false;
  let hasEnd = false;
  const imageDataChunks = [];

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) invalid("truncated chunk header or checksum");
    const dataLength = buffer.readUInt32BE(offset);
    if (dataLength > buffer.length - offset - 12) invalid("truncated chunk data");
    const typeBytes = buffer.subarray(offset + 4, offset + 8);
    if (![...typeBytes].every((byte) =>
      (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122))) {
      invalid("chunk type contains non-letter bytes");
    }
    const type = typeBytes.toString("ascii");
    if (typeBytes[2] < 65 || typeBytes[2] > 90) invalid("chunk type reserved bit is set");
    const dataStart = offset + 8;
    const dataEnd = dataStart + dataLength;
    let crc = 0xffffffff;
    for (let index = offset + 4; index < dataEnd; index++) {
      crc = PNG_CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    if (crc !== buffer.readUInt32BE(dataEnd)) invalid(`${type} chunk checksum does not match`);

    if (!hasHeader && type !== "IHDR") invalid("IHDR is not the first chunk");
    if (hasImageData && type !== "IDAT" && type !== "IEND") imageDataEnded = true;
    if (type === "IDAT" && imageDataEnded) invalid("IDAT chunks are not consecutive");

    if (type === "IHDR") {
      if (hasHeader || chunkCount !== 0 || dataLength !== 13) invalid("IHDR chunk is misplaced or malformed");
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
      const compressionMethod = buffer[dataStart + 10];
      const filterMethod = buffer[dataStart + 11];
      interlaceMethod = buffer[dataStart + 12];
      const validDepths = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      if (
        width === 0 || height === 0 ||
        width > 0x7fffffff || height > 0x7fffffff ||
        !validDepths[colorType]?.includes(bitDepth) ||
        compressionMethod !== 0 || filterMethod !== 0 ||
        ![0, 1].includes(interlaceMethod)
      ) {
        invalid("IHDR fields are invalid");
      }
      hasHeader = true;
    } else if (type === "PLTE") {
      if (
        hasPalette || hasImageData || dataLength === 0 || dataLength > 768 || dataLength % 3 !== 0 ||
        colorType === 0 || colorType === 4 ||
        (colorType === 3 && dataLength / 3 > 2 ** bitDepth)
      ) {
        invalid("PLTE chunk is misplaced or malformed");
      }
      hasPalette = true;
    } else if (type === "IDAT") {
      hasImageData = true;
      imageDataChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      if (dataLength !== 0 || !hasImageData) invalid("IEND chunk is malformed or precedes image data");
      if (dataEnd + 4 !== buffer.length) invalid("bytes follow the IEND chunk");
      hasEnd = true;
    } else if ((typeBytes[0] & 0x20) === 0) {
      invalid(`unknown critical ${type} chunk`);
    }

    offset = dataEnd + 4;
    chunkCount++;
    if (hasEnd) break;
  }

  if (!hasHeader) invalid("IHDR chunk is missing");
  if (!hasImageData) invalid("IDAT image data is missing");
  if (!hasEnd) invalid("IEND chunk is missing or truncated");
  if (colorType === 3 && !hasPalette) invalid("indexed-color image has no PLTE chunk");

  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 })[colorType];
  const expectedLength = pngExpectedImageDataLength(
    width,
    height,
    channels * bitDepth,
    interlaceMethod,
  );
  if (!Number.isSafeInteger(expectedLength) || expectedLength > PNG_MAX_DECODED_BYTES) {
    invalid("image dimensions exceed the validation limit");
  }

  const compressedImageData = Buffer.concat(imageDataChunks);
  let inflated;
  try {
    inflated = inflateSync(compressedImageData, {
      maxOutputLength: expectedLength,
      info: true,
    });
  } catch {
    invalid("IDAT image data cannot be decompressed");
  }
  if (inflated.engine.bytesWritten !== compressedImageData.length) {
    invalid("IDAT contains bytes after the zlib stream");
  }
  const decoded = inflated.buffer;
  if (decoded.length !== expectedLength) invalid("IDAT decompressed length does not match IHDR dimensions");

  const passes = interlaceMethod === 0
    ? [[0, 0, 1, 1]]
    : [
        [0, 0, 8, 8],
        [4, 0, 8, 8],
        [0, 4, 4, 8],
        [2, 0, 4, 4],
        [0, 2, 2, 4],
        [1, 0, 2, 2],
        [0, 1, 1, 2],
      ];
  let decodedOffset = 0;
  for (const [startX, startY, stepX, stepY] of passes) {
    const passWidth = width <= startX ? 0 : Math.ceil((width - startX) / stepX);
    const passHeight = height <= startY ? 0 : Math.ceil((height - startY) / stepY);
    if (passWidth === 0 || passHeight === 0) continue;
    const rowBytes = Math.ceil((passWidth * channels * bitDepth) / 8);
    for (let row = 0; row < passHeight; row++) {
      if (decoded[decodedOffset] > 4) invalid("scanline uses an invalid PNG filter");
      decodedOffset += rowBytes + 1;
    }
  }
  if (decodedOffset !== decoded.length) invalid("scanline data does not match IHDR dimensions");
}

/** Only a date labelled in PNG content metadata is extracted automatically. */
export function extractBonapMapGenerationDate(bytes) {
  const text = pngTextChunks(bytes).join("\n");
  const match = text.match(/\b(?:map\s+)?generated(?:\s+(?:on|date))?\s*[:=]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i);
  if (!match) return null;
  const candidate = match[1];
  const normalized = candidate.includes("-") && /^\d{4}-/.test(candidate)
    ? candidate
    : (() => {
        const [month, day, year] = candidate.split(/[/-]/);
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      })();
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized
    ? null
    : normalized;
}

export async function fetchBonapSourceSnapshot({
  plants,
  countyFipses,
  fetchImpl = fetch,
  now = new Date(),
  concurrency = 6,
  previousTaxa = [],
  verifiedFullTaxonListBytes = BONAP_FULL_TAXON_LIST_VERIFIED_BYTES,
  onCounty = () => {},
}) {
  const retrievedAt = now.toISOString();
  const taxonResponse = await request(BONAP_URLS.fullTaxonList, {
    headers: { accept: "text/plain" },
  }, fetchImpl);
  const fullTaxonListBuffer = Buffer.from(await taxonResponse.arrayBuffer());
  if (fullTaxonListBuffer.byteLength !== verifiedFullTaxonListBytes) {
    throw new Error(
      `BONAP FullTaxonList completeness check failed: received ${fullTaxonListBuffer.byteLength} bytes; expected the reviewed ${verifiedFullTaxonListBytes}-byte response`,
    );
  }
  const contentLength = Number(taxonResponse.headers?.get?.("content-length"));
  const contentEncoding = taxonResponse.headers?.get?.("content-encoding");
  if (
    Number.isSafeInteger(contentLength) &&
    contentLength > 0 &&
    !contentEncoding &&
    contentLength !== fullTaxonListBuffer.byteLength
  ) {
    throw new Error("BONAP FullTaxonList body length does not match its Content-Length");
  }
  let fullTaxonListText;
  try {
    fullTaxonListText = new TextDecoder("utf-8", { fatal: true }).decode(fullTaxonListBuffer);
  } catch {
    throw new Error("BONAP FullTaxonList is not valid UTF-8");
  }
  const taxa = parseBonapFullTaxonList(fullTaxonListText);
  if (taxa.length === 0) throw new Error("BONAP FullTaxonList contained no taxon rows");
  assertNoPreviouslyListedTaxaOmitted(taxa, previousTaxa);

  const plantEntries = Object.values(plants);
  const taxonMatches = plantEntries.map((plant) => {
    const match = matchBonapTaxon(plant.scientificName, taxa);
    return {
      plantId: plant.id,
      scientificName: plant.scientificName,
      matchStatus: match.status,
      bonapScientificName: match.status === "exact" ? match.matches[0].scientificName : null,
    };
  });
  const candidateNames = new Map(
    taxonMatches
      .filter((match) => match.matchStatus === "exact")
      .map((match) => [normalizeScientificName(match.scientificName), match.plantId]),
  );

  const counties = [...new Set(countyFipses)].sort();
  if (counties.some((fips) => !/^\d{5}$/.test(fips) || !LOWER48_FIPS_PREFIXES.has(fips.slice(0, 2)))) {
    throw new Error("BONAP occurrence refresh requires lower-48 county FIPS values");
  }
  const countyOccurrences = await mapLimit(counties, concurrency, async (countyFips, index) => {
    const taxaInCounty = [];
    const pageUpdateMarkers = [];
    const seenTaxonIds = new Map();
    const seenPages = new Set();
    let page = "-1";
    let pageCount = 0;
    let reportedSpeciesAndNothospeciesCount = null;
    while (page !== null) {
      if (seenPages.has(page)) throw new Error(`BONAP SpeciesList repeated page ${page} for ${countyFips}`);
      seenPages.add(page);
      const response = await request(BONAP_URLS.speciesList, {
        method: "POST",
        headers: {
          ...tdcAjaxHeaders("application/json, text/javascript, */*; q=0.01"),
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: tdcQueryForm({ countyFips, page }),
      }, fetchImpl);
      const payload = await parseTdcJson(response, `BONAP SpeciesList for ${countyFips}`);
      const pageTaxa = parseBonapSpeciesList(payload, countyFips);
      const reportedCount = speciesAndNothospeciesCount(payload);
      if (
        reportedCount !== null &&
        reportedSpeciesAndNothospeciesCount !== null &&
        reportedCount !== reportedSpeciesAndNothospeciesCount
      ) {
        throw new Error(`BONAP SpeciesList changed its reported taxon count during county ${countyFips} pagination`);
      }
      if (reportedCount !== null) reportedSpeciesAndNothospeciesCount = reportedCount;
      for (const taxon of pageTaxa) {
        const previousName = seenTaxonIds.get(taxon.bonapTaxonId);
        if (previousName !== undefined) {
          if (normalizeScientificName(previousName) !== normalizeScientificName(taxon.scientificName)) {
            throw new Error(`BONAP SpeciesList ID ${taxon.bonapTaxonId} resolves to multiple names in ${countyFips}`);
          }
          throw new Error(`BONAP SpeciesList repeated taxon ID ${taxon.bonapTaxonId} in ${countyFips}`);
        }
        seenTaxonIds.set(taxon.bonapTaxonId, taxon.scientificName);
        taxaInCounty.push(taxon);
      }
      pageCount++;
      pageUpdateMarkers.push({
        page,
        etag: response.headers?.get?.("etag") ?? null,
        lastModified: response.headers?.get?.("last-modified") ?? null,
      });
      const nextPage = payload?.data?.NextPage ?? payload?.NextPage ?? null;
      if (nextPage == null || nextPage === "") page = null;
      else if (/^\d+$/.test(String(nextPage))) page = String(nextPage);
      else throw new Error(`BONAP SpeciesList returned an invalid next page for ${countyFips}`);
    }
    if (reportedSpeciesAndNothospeciesCount === null) {
      throw new Error(`BONAP SpeciesList did not report a complete species and nothospecies count for county ${countyFips}`);
    }
    const speciesAndNothospeciesTaxonCount = speciesAndNothospeciesRowCount(taxaInCounty);
    const infraspecificTaxonCount = taxaInCounty.length - speciesAndNothospeciesTaxonCount;
    if (speciesAndNothospeciesTaxonCount !== reportedSpeciesAndNothospeciesCount) {
      throw new Error(
        `BONAP SpeciesList returned ${speciesAndNothospeciesTaxonCount} species and nothospecies in ${taxaInCounty.length} taxon rows for county ${countyFips}, but reported ${reportedSpeciesAndNothospeciesCount}`,
      );
    }
    const candidateTaxa = taxaInCounty.flatMap((taxon) => {
      const plantId = candidateNames.get(normalizeScientificName(taxon.scientificName));
      return plantId
        ? [{ plantId, bonapTaxonId: taxon.bonapTaxonId, scientificName: taxon.scientificName, countyFips }]
        : [];
    });
    onCounty({
      countyFips,
      occurrenceTaxonCount: taxaInCounty.length,
      speciesAndNothospeciesTaxonCount,
      infraspecificTaxonCount,
      index: index + 1,
      total: counties.length,
    });
    return {
      countyFips,
      occurrenceTaxonCount: taxaInCounty.length,
      speciesAndNothospeciesTaxonCount,
      infraspecificTaxonCount,
      reportedSpeciesAndNothospeciesCount,
      pageCount,
      pageUpdateMarkers,
      candidateTaxa,
      evidenceUse: "presence_only",
      retrievedAt,
      etag: pageUpdateMarkers[0]?.etag ?? null,
      lastModified: pageUpdateMarkers[0]?.lastModified ?? null,
    };
  });

  const candidateTaxaById = new Map();
  for (const occurrence of countyOccurrences) {
    for (const taxon of occurrence.candidateTaxa) {
      const previous = candidateTaxaById.get(taxon.bonapTaxonId);
      if (previous && normalizeScientificName(previous.scientificName) !== normalizeScientificName(taxon.scientificName)) {
        throw new Error(`BONAP source taxon ID ${taxon.bonapTaxonId} resolves to multiple names`);
      }
      candidateTaxaById.set(taxon.bonapTaxonId, taxon);
    }
  }

  const taxonDetails = await mapLimit([...candidateTaxaById.values()], concurrency, async (taxon) => {
    const parentResponse = await request(BONAP_URLS.parentForTaxon, {
      method: "POST",
      headers: {
        ...tdcAjaxHeaders("application/json, text/javascript, */*; q=0.01"),
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: new URLSearchParams({ familyType: "0", rank: "2", taxonId: taxon.bonapTaxonId }),
    }, fetchImpl);
    const parents = await parseTdcJson(parentResponse, `BONAP ParentForTaxon for ${taxon.bonapTaxonId}`);
    if (
      !Array.isArray(parents) || parents.length < 2 ||
      !/^\d+$/.test(String(parents[0])) || !/^\d+$/.test(String(parents[1]))
    ) {
      throw new Error(`BONAP ParentForTaxon returned invalid parent IDs for ${taxon.bonapTaxonId}`);
    }
    const response = await request(BONAP_URLS.taxonDetails, {
      method: "POST",
      headers: {
        ...tdcAjaxHeaders("text/html, */*; q=0.01"),
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: tdcQueryForm({
        countyFips: taxon.countyFips,
        familyId: String(parents[0]),
        genusId: String(parents[1]),
        speciesId: taxon.bonapTaxonId,
        lastSelectedRank: "2",
      }),
    }, fetchImpl);
    let html;
    try {
      html = await response.text();
    } catch {
      throw new Error(`BONAP TaxonDetails for ${taxon.bonapTaxonId} returned unreadable profile HTML`);
    }
    return {
      ...parseBonapTaxonDetails(html, taxon.bonapTaxonId, taxon.scientificName),
      retrievedAt,
      contentSha256: createHash("sha256").update(html).digest("hex"),
      etag: response.headers?.get?.("etag") ?? null,
      lastModified: response.headers?.get?.("last-modified") ?? null,
    };
  });

  return {
    sourceId: "bonap-napa",
    retrievedAt,
    fullTaxonList: {
      taxonCount: taxa.length,
      taxa,
      url: BONAP_URLS.fullTaxonList,
      citationYear: 2014,
      completenessCheck: "verified_response_bytes_and_strict_tsv_v1",
      verifiedResponseBytes: verifiedFullTaxonListBytes,
      responseBytes: fullTaxonListBuffer.byteLength,
      sha256: createHash("sha256").update(fullTaxonListBuffer).digest("hex"),
      contentLength:
        Number.isSafeInteger(contentLength) && contentLength > 0 && !contentEncoding
          ? contentLength
          : null,
      etag: taxonResponse.headers?.get?.("etag") ?? null,
      lastModified: taxonResponse.headers?.get?.("last-modified") ?? null,
    },
    taxonMatches,
    countyOccurrences,
    taxonDetails,
    mapSnapshots: [],
  };
}

export async function fetchBonapMapSnapshots({
  plants,
  taxonMatches,
  fetchImpl = fetch,
  now = new Date(),
  concurrency = 6,
}) {
  const retrievedAt = now.toISOString();
  const exactMatches = new Set(
    taxonMatches.filter((match) => match.matchStatus === "exact").map((match) => match.plantId),
  );
  const selectedPlants = Object.values(plants).filter((plant) => exactMatches.has(plant.id));
  const genusPages = new Map();
  for (const plant of selectedPlants) {
    const genus = plant.scientificName.trim().split(/\s+/)[0];
    const pageUrl = `${BONAP_URLS.napaGenusCounty}${encodeURIComponent(genus)}`;
    genusPages.set(pageUrl, { genus, pageUrl });
  }
  const pages = await mapLimit([...genusPages.values()], concurrency, async ({ pageUrl }) => {
    const response = await request(pageUrl, { headers: { accept: "text/html" } }, fetchImpl);
    return { pageUrl, html: await response.text() };
  });
  const htmlByPage = new Map(pages.map((page) => [page.pageUrl, page.html]));
  const candidates = selectedPlants.map((plant) => {
    const genus = plant.scientificName.trim().split(/\s+/)[0];
    const pageUrl = `${BONAP_URLS.napaGenusCounty}${encodeURIComponent(genus)}`;
    return {
      plantId: plant.id,
      scientificName: plant.scientificName,
      pageUrl,
      mapLink: parseNapaTaxonMapLink(htmlByPage.get(pageUrl), pageUrl, plant.scientificName),
    };
  });
  const exactLinks = [...new Set(candidates.filter((candidate) => candidate.mapLink.status === "exact").map((candidate) => candidate.mapLink.url))];
  const snapshots = await mapLimit(exactLinks, concurrency, async (mapUrl) => {
    const response = await request(mapUrl, { headers: { accept: "image/png" } }, fetchImpl);
    const bytes = Buffer.from(await response.arrayBuffer());
    try {
      assertValidBonapCountyMapPng(bytes);
    } catch (error) {
      throw new Error(`BONAP county map is not a complete PNG image: ${mapUrl}`, { cause: error });
    }
    return {
      mapUrl,
      retrievedAt,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      etag: response.headers?.get?.("etag") ?? null,
      lastModified: response.headers?.get?.("last-modified") ?? null,
      mapGenerationDate: extractBonapMapGenerationDate(bytes),
      mapGenerationDateSource: extractBonapMapGenerationDate(bytes) ? "png_content_metadata" : null,
      mapKeyUrl: BONAP_URLS.mapKey,
      assetName: null,
      bytes,
    };
  });
  const snapshotByUrl = new Map(snapshots.map((snapshot) => [snapshot.mapUrl, snapshot]));
  return {
    mappings: candidates.map((candidate) => ({
      plantId: candidate.plantId,
      scientificName: candidate.scientificName,
      mapPageUrl: candidate.pageUrl,
      mapStatus: candidate.mapLink.status,
      mapUrl: candidate.mapLink.url,
      mapSha256: candidate.mapLink.url ? snapshotByUrl.get(candidate.mapLink.url)?.sha256 ?? null : null,
    })),
    snapshots,
  };
}

export function buildBonapCountyEvidence({ plants, mapSnapshots, reviews, source }) {
  const snapshotByHash = new Map(mapSnapshots.map((snapshot) => [snapshot.sha256, snapshot]));
  const records = [];
  for (const review of reviews) {
    const snapshot = snapshotByHash.get(review.mapSha256);
    const plant = plants[review.plantId];
    if (!snapshot || !plant || snapshot.mapUrl !== review.mapUrl) continue;
    if (
      review.taxonomyMatch !== "exact" ||
      !review.currentStatusConfirmed ||
      review.reviewStatus !== "approved" ||
      !review.reviewer?.trim() ||
      !review.reviewedAt ||
      Number.isNaN(Date.parse(review.reviewedAt)) ||
      !review.reviewNote?.trim()
    ) continue;
    if (normalizeScientificName(plant.scientificName) !== normalizeScientificName(review.scientificName)) continue;
    const observedDate = review.mapGenerationDateFromContent ?? snapshot.mapGenerationDate ?? null;
    const observedDateSource = review.mapGenerationDateFromContent
      ? "visual_map_content"
      : snapshot.mapGenerationDateSource ?? null;
    for (const conversion of review.counties ?? []) {
      if (!/^\d{5}$/.test(conversion.countyFips ?? "")) continue;
      const category = String(conversion.rawCategory ?? "");
      const mappedStatus = category === "Native"
        ? "native"
        : ["Native Historic", "Adventive", "Exotic"].includes(category)
          ? "not_native"
          : "unknown";
      const mapScopeConfirmed = review.mapScopeDecision === "confirmed_taxon_scope";
      const nativityStatus = mapScopeConfirmed ? mappedStatus : "unknown";
      records.push({
        plantId: plant.id,
        sourceId: "bonap-napa",
        sourceCitation: `BONAP, North American Plant Atlas. County map for ${plant.scientificName}; map category ${JSON.stringify(category)}; map SHA-256 ${snapshot.sha256}; MapKey ${BONAP_URLS.mapKey}.`,
        sourceUrl: snapshot.mapUrl,
        releaseOrObservationDate: observedDate,
        retrievedAt: snapshot.retrievedAt,
        licenseNote: source.licenseNote,
        geographicScope: `County FIPS ${conversion.countyFips}; ${plant.scientificName}.`,
        spatialResolution: "county",
        countyFips: conversion.countyFips,
        nativityStatus,
        uncertainty: !mapScopeConfirmed
          ? `BONAP map scope ${JSON.stringify(review.mapScopeDecision)} does not confirm that county colors apply specifically to ${plant.scientificName}; the raw category is preserved as unknown.`
          : category === "Native"
            ? null
            : `BONAP county category ${JSON.stringify(category)} is preserved and is not current native status.`,
        bonapReview: {
          mapSha256: snapshot.sha256,
          mapKeyUrl: BONAP_URLS.mapKey,
          mapGenerationDate: observedDate,
          mapGenerationDateSource: observedDateSource,
          etag: snapshot.etag,
          lastModified: snapshot.lastModified,
          rawCategory: category,
          taxonomyMatch: review.taxonomyMatch,
          mapScopeDecision: review.mapScopeDecision,
          reviewStatus: review.reviewStatus,
          currentStatusConfirmed: review.currentStatusConfirmed,
          reviewer: review.reviewer,
          reviewedAt: review.reviewedAt,
          reviewNote: review.reviewNote ?? null,
        },
      });
    }
  }
  return records;
}
