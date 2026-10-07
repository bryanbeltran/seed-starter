import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  BONAP_URLS,
  BONAP_FULL_TAXON_LIST_VERIFIED_BYTES,
  buildBonapCountyEvidence,
  extractBonapMapGenerationDate,
  fetchBonapMapSnapshots,
  fetchBonapSourceSnapshot,
  matchBonapTaxon,
  parseBonapFullTaxonList,
  parseBonapSpeciesList,
  parseNapaTaxonMapLink,
  parseBonapTaxonDetails,
} from "./bonap-native-source.mjs";

const taxonText = [
  "BONAP Taxonomic Data Center\t2014",
  "Family\tGenus\tScientific Name",
  "Asteraceae\tEchinacea\tEchinacea angustifolia",
  "Asteraceae\tEchinacea\tEchinacea angustifolia var. strigosa",
].join("\n");

function pngChunk(type, data) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 8 + data.length)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
  return chunk;
}

function pngWithText(text) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const metadata = Buffer.concat([Buffer.from("Comment\0"), Buffer.from(text)]);
  const pixels = deflateSync(Buffer.from([0, 0, 0, 0, 0]));
  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("tEXt", metadata),
    pngChunk("IDAT", pixels),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("BONAP source adapter", () => {
  it("parses taxon names without inventing stable IDs from FullTaxonList", () => {
    const taxa = parseBonapFullTaxonList(taxonText);
    expect(taxa).toEqual([
      { family: "Asteraceae", genus: "Echinacea", scientificName: "Echinacea angustifolia" },
      {
        family: "Asteraceae",
        genus: "Echinacea",
        scientificName: "Echinacea angustifolia var. strigosa",
      },
    ]);
    expect(taxa[0]).not.toHaveProperty("id");
  });

  it("accepts the live BONAP publisher attribution before the TSV rows", () => {
    const taxa = parseBonapFullTaxonList([
      "© Kartesz, J.T., The Biota of North America Program (BONAP). 2014. BONAP’s Taxonomic Data Center (TDC) (http://bonap.net/TDC/). Chapel Hill, N.C.",
      "ACANTHACEAE\tAcanthus\tAcanthus mollis",
    ].join("\n"));
    expect(taxa).toEqual([{
      family: "ACANTHACEAE",
      genus: "Acanthus",
      scientificName: "Acanthus mollis",
    }]);
  });

  it("accepts BONAP hybrid-genus markers as taxonomic data", () => {
    expect(parseBonapFullTaxonList("ASTERACEAE\t×Argyrautia\t×Argyrautia degeneri")).toEqual([{
      family: "ASTERACEAE",
      genus: "×Argyrautia",
      scientificName: "×Argyrautia degeneri",
    }]);
  });

  it("rejects malformed FullTaxonList rows instead of silently dropping them", () => {
    expect(() => parseBonapFullTaxonList(`${taxonText}\ntruncated valid-looking row`)).toThrow(
      /malformed non-TSV row/,
    );
  });

  it("rejects a valid but truncated FullTaxonList before it can become a crosswalk", async () => {
    const requests = [];
    const fetchImpl = async (url) => {
      requests.push(String(url));
      return new Response(taxonText, { status: 200 });
    };
    await expect(fetchBonapSourceSnapshot({
      plants: { plant: { id: "plant", scientificName: "Echinacea angustifolia" } },
      countyFipses: [],
      fetchImpl,
    })).rejects.toThrow(new RegExp(`expected the reviewed ${BONAP_FULL_TAXON_LIST_VERIFIED_BYTES}-byte response`));
    expect(requests).toEqual([BONAP_URLS.fullTaxonList]);
  });

  it("rejects cross-host redirects before requesting their target", async () => {
    const requests = [];
    const fetchImpl = async (url, options = {}) => {
      requests.push({ url: String(url), redirect: options.redirect });
      return new Response(null, {
        status: 302,
        headers: { location: "https://unapproved.example/internal" },
      });
    };

    await expect(fetchBonapSourceSnapshot({
      plants: {},
      countyFipses: [],
      fetchImpl,
    })).rejects.toThrow(/redirect target outside the approved HTTPS host/);
    expect(requests).toEqual([{ url: BONAP_URLS.fullTaxonList, redirect: "manual" }]);
  });

  it("does not let an omitted duplicate turn a previous ambiguous taxon match exact", async () => {
    const duplicateName = "Asteraceae\tEchinacea\tEchinacea angustifolia";
    const previousTaxa = parseBonapFullTaxonList(
      `${taxonText}\n${duplicateName}`,
    );
    expect(matchBonapTaxon("Echinacea angustifolia", previousTaxa).status).toBe("ambiguous");
    expect(matchBonapTaxon("Echinacea angustifolia", parseBonapFullTaxonList(taxonText)).status).toBe("exact");
    const fetchImpl = async () => new Response(taxonText, { status: 200 });
    await expect(fetchBonapSourceSnapshot({
      plants: { plant: { id: "plant", scientificName: "Echinacea angustifolia" } },
      countyFipses: [],
      previousTaxa,
      verifiedFullTaxonListBytes: Buffer.byteLength(taxonText),
      fetchImpl,
    })).rejects.toThrow(/omitted previously listed taxon Echinacea angustifolia/);
  });

  it("distinguishes exact, infraspecific, and ambiguous taxon matches", () => {
    const taxa = parseBonapFullTaxonList(taxonText);
    expect(matchBonapTaxon("Echinacea angustifolia", taxa).status).toBe("exact");
    expect(matchBonapTaxon("Echinacea angustifolia var. alba", taxa).status).toBe("unresolved");
    expect(matchBonapTaxon("Echinacea angustifolia", [taxa[0], { ...taxa[0] }]).status).toBe("ambiguous");
  });

  it("records TDC SpeciesList rows as source-scoped presence only", () => {
    const rows = parseBonapSpeciesList({
      data: {
        TaxonList: [{ Id: 1234, Name: "Echinacea angustifolia", Nativity: "Native" }],
        DescriptionText: "A total of <span>1</span> species and nothospecies are reported.",
      },
    }, "27053");
    expect(rows).toEqual([{
      countyFips: "27053",
      bonapTaxonId: "1234",
      scientificName: "Echinacea angustifolia",
      evidenceUse: "presence_only",
    }]);
    expect(rows[0]).not.toHaveProperty("nativityStatus");
  });

  it("uses the TDC endpoints for occurrence and identity without deriving nativity", async () => {
    const requests = [];
    const fetchImpl = async (url, options = {}) => {
      const parsed = new URL(url);
      requests.push({
        url: parsed.href,
        method: options.method ?? "GET",
        body: options.body == null ? null : String(options.body),
        headers: options.headers ?? {},
      });
      if (parsed.pathname.endsWith("FullTaxonList")) {
        return new Response(taxonText, { status: 200, headers: { etag: '"taxa"' } });
      }
      if (parsed.pathname.endsWith("SpeciesList")) {
        const page = new URLSearchParams(options.body).get("selectedSpeciesPage");
        const isFirstPage = page === "-1";
        return new Response(JSON.stringify({ data: {
          DescriptionText: "A total of <span>2</span> species and nothospecies are reported.",
          NextPage: isFirstPage ? "1" : null,
          TaxonList: isFirstPage
            ? [
                { Id: 1234, Name: "Echinacea angustifolia", Nativity: "Native" },
                { Id: 5678, Name: "Another genus species", Nativity: "Unknown" },
              ]
            : [{ Id: 9012, Name: "Echinacea angustifolia var. strigosa", Nativity: "Native" }],
        } }), { status: 200, headers: { etag: `"page-${page}"` } });
      }
      if (parsed.pathname.endsWith("ParentForTaxon")) {
        return new Response(JSON.stringify([35, 570]), { status: 200 });
      }
      if (parsed.pathname.endsWith("TaxonDetails")) {
        return new Response(`
          <div id="speciesHeader">Echinacea angustifolia<span class="h-cn">Blacksamson</span></div>
          <div id="countyMap"><img src="/MapGallery/County/Echinacea%20angustifolia.png" /></div>
          <div style="font-weight:bold; text-decoration:underline">Nativity</div>
          <div style="font-weight:bold">Continental</div><div>Native</div>`,
        { status: 200, headers: { etag: '"details"' } });
      }
      throw new Error(`Unexpected BONAP URL: ${url}`);
    };
    const snapshot = await fetchBonapSourceSnapshot({
      plants: {
        "echinacea-angustifolia": {
          id: "echinacea-angustifolia",
          scientificName: "Echinacea angustifolia",
        },
      },
      countyFipses: ["27053"],
      fetchImpl,
      verifiedFullTaxonListBytes: Buffer.byteLength(taxonText),
      now: new Date("2026-10-01T12:00:00.000Z"),
    });

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/TDC/Query/FullTaxonList",
      "/TDC/Query/SpeciesList",
      "/TDC/Query/SpeciesList",
      "/TDC/Query/ParentForTaxon",
      "/TDC/Query/TaxonDetails",
    ]);
    const speciesQuery = new URLSearchParams(requests[1].body);
    expect(Object.fromEntries(speciesQuery)).toMatchObject({
      fipsCodeSearch: "27053",
      state: "MN",
      taxonPerPage: "10000",
      selectedSpeciesPage: "-1",
    });
    expect(requests[1].headers["x-requested-with"]).toBe("XMLHttpRequest");
    expect(new URLSearchParams(requests[3].body).get("taxonId")).toBe("1234");
    expect(Object.fromEntries(new URLSearchParams(requests[4].body))).toMatchObject({
      familyId: "35",
      genusId: "570",
      speciesId: "1234",
      lastSelectedRank: "2",
    });
    expect(snapshot.countyOccurrences[0]).toMatchObject({
      countyFips: "27053",
      occurrenceTaxonCount: 3,
      speciesAndNothospeciesTaxonCount: 2,
      infraspecificTaxonCount: 1,
      reportedSpeciesAndNothospeciesCount: 2,
      pageCount: 2,
      evidenceUse: "presence_only",
      candidateTaxa: [{ plantId: "echinacea-angustifolia", bonapTaxonId: "1234" }],
    });
    expect(snapshot.taxonDetails[0]).toMatchObject({
      bonapTaxonId: "1234",
      continentalNativity: "Native",
      countyOccurrenceMapCount: 1,
      countyOccurrenceMapUrl: "https://bonap.net/MapGallery/County/Echinacea%20angustifolia.png",
      evidenceUse: "identity_and_occurrence_only",
    });
    expect(snapshot.taxonDetails[0]).not.toHaveProperty("nativityStatus");
  });

  it("validates the species count separately from infraspecific rows in the Hennepin response shape", async () => {
    const taxonRows = [
      ...Array.from({ length: 1479 }, (_, index) => ({
        Id: index + 1,
        Name: index === 0 ? "Echinacea angustifolia" : `Genus${index} species${index}`,
      })),
      ...Array.from({ length: 374 }, (_, index) => ({
        Id: index + 2000,
        Name: `Echinacea angustifolia var. form${index}`,
      })),
    ];
    const fetchImpl = async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("FullTaxonList")) {
        return new Response(taxonText, { status: 200 });
      }
      if (parsed.pathname.endsWith("SpeciesList")) {
        return new Response(JSON.stringify({ data: {
          DescriptionText: "A total of 1,479 species and nothospecies are reported.",
          NextPage: null,
          TaxonList: taxonRows,
        } }), { status: 200 });
      }
      if (parsed.pathname.endsWith("ParentForTaxon")) {
        return new Response(JSON.stringify([35, 570]), { status: 200 });
      }
      if (parsed.pathname.endsWith("TaxonDetails")) {
        return new Response(`
          <div id="speciesHeader">Echinacea angustifolia<span class="h-cn">Blacksamson</span></div>
          <div id="countyMap"><img src="/MapGallery/County/Echinacea%20angustifolia.png" /></div>`,
        { status: 200 });
      }
      throw new Error(`Unexpected BONAP URL: ${url}`);
    };

    const snapshot = await fetchBonapSourceSnapshot({
      plants: {
        "echinacea-angustifolia": {
          id: "echinacea-angustifolia",
          scientificName: "Echinacea angustifolia",
        },
      },
      countyFipses: ["27053"],
      fetchImpl,
      verifiedFullTaxonListBytes: Buffer.byteLength(taxonText),
    });

    expect(snapshot.countyOccurrences[0]).toMatchObject({
      occurrenceTaxonCount: 1853,
      speciesAndNothospeciesTaxonCount: 1479,
      infraspecificTaxonCount: 374,
      reportedSpeciesAndNothospeciesCount: 1479,
    });
  });

  it("rejects a syntactically valid short county list with a nonzero reported count", async () => {
    const shortTaxonText = [
      "BONAP Taxonomic Data Center\t2014",
      "Family\tGenus\tScientific Name",
      "Asteraceae\tEchinacea\tEchinacea angustifolia",
    ].join("\n");
    const fetchImpl = async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("FullTaxonList")) {
        return new Response(shortTaxonText, { status: 200 });
      }
      if (parsed.pathname.endsWith("SpeciesList")) {
        return new Response(JSON.stringify({ data: {
          DescriptionText: "A total of 2 species and nothospecies are reported.",
          NextPage: null,
          TaxonList: [{ Id: 1234, Name: "Echinacea angustifolia" }],
        } }), { status: 200 });
      }
      throw new Error(`Unexpected BONAP URL: ${url}`);
    };

    await expect(fetchBonapSourceSnapshot({
      plants: { plant: { id: "plant", scientificName: "Echinacea angustifolia" } },
      countyFipses: ["27053"],
      fetchImpl,
      verifiedFullTaxonListBytes: Buffer.byteLength(shortTaxonText),
    })).rejects.toThrow(/returned 1 species and nothospecies in 1 taxon rows for county 27053, but reported 2/);
  });

  it("keeps TaxonDetails continental nativity separate from county status", () => {
    expect(parseBonapTaxonDetails({
      Taxon: {
        Id: 1234,
        Name: "Echinacea angustifolia",
        "Nativity Continental Native": true,
        VerifiedCountyMaps: [{ CountyFips: "27053" }],
      },
    }, 1234, "Echinacea angustifolia")).toEqual({
      bonapTaxonId: "1234",
      scientificName: "Echinacea angustifolia",
      continentalNativity: true,
      countyOccurrenceMapCount: 1,
      countyOccurrenceMapUrl: null,
      evidenceUse: "identity_and_occurrence_only",
    });
  });

  it("follows exact per-taxon links from the live NAPA page, not aggregate maps", () => {
    const html = `
      <a href="/MapGallery/County/Genus/Echinacea.png">Echinacea genus map</a>
      <a href="/MapGallery/County/Echinacea%20angustifolia.png">Echinacea angustifolia</a>
      <a href="/MapGallery/County/Echinacea%20angustifolia%20var.%20strigosa.png">Echinacea angustifolia var. strigosa</a>`;
    expect(parseNapaTaxonMapLink(
      html,
      "https://bonap.net/Napa/TaxonMaps/Genus/County/Echinacea",
      "Echinacea angustifolia",
    )).toEqual({
      status: "exact",
      url: "https://bonap.net/MapGallery/County/Echinacea%20angustifolia.png",
    });
    expect(parseNapaTaxonMapLink(
      html,
      "https://bonap.net/Napa/TaxonMaps/Genus/County/Echinacea",
      "Echinacea angustifolia var. alba",
    )).toEqual({ status: "unresolved", url: null });
  });

  it("reads only generation dates present in map content and leaves unavailable explicit", () => {
    expect(extractBonapMapGenerationDate(pngWithText("Map generated 12/14/2014"))).toBe("2014-12-14");
    expect(extractBonapMapGenerationDate(pngWithText("Created with image software"))).toBeNull();
    expect(extractBonapMapGenerationDate(Buffer.from("not a PNG"))).toBeNull();
  });

  it("captures maps only from exact live-page links and records content/update markers", async () => {
    const requests = [];
    const image = pngWithText("Map generated 12/14/2014");
    const fetchImpl = async (url) => {
      requests.push(new URL(url).href);
      if (String(url).includes("/Napa/TaxonMaps/Genus/County/Echinacea")) {
        return new Response('<a href="/MapGallery/County/Echinacea%20angustifolia.png">Echinacea angustifolia</a>', { status: 200 });
      }
      if (String(url).endsWith("Echinacea%20angustifolia.png")) {
        return new Response(image, {
          status: 200,
          headers: { etag: '"image"', "last-modified": "Fri, 19 May 2017 00:00:00 GMT" },
        });
      }
      throw new Error(`Unexpected BONAP map URL: ${url}`);
    };
    const result = await fetchBonapMapSnapshots({
      plants: {
        "echinacea-angustifolia": {
          id: "echinacea-angustifolia",
          scientificName: "Echinacea angustifolia",
        },
      },
      taxonMatches: [{ plantId: "echinacea-angustifolia", matchStatus: "exact" }],
      fetchImpl,
      now: new Date("2026-10-01T12:00:00.000Z"),
    });
    expect(requests[0]).toBe("https://bonap.net/Napa/TaxonMaps/Genus/County/Echinacea");
    expect(result.mappings[0]).toMatchObject({
      mapStatus: "exact",
      mapSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(result.snapshots[0]).toMatchObject({
      mapUrl: "https://bonap.net/MapGallery/County/Echinacea%20angustifolia.png",
      mapGenerationDate: "2014-12-14",
      etag: '"image"',
      lastModified: "Fri, 19 May 2017 00:00:00 GMT",
    });
    expect(result.snapshots[0].sha256).toBeDefined();
    expect(result.snapshots[0].bytes).toEqual(image);
  });

  it("rejects a truncated linked county PNG before it can be snapshotted", async () => {
    const validPng = pngWithText("Map generated 12/14/2014");
    const truncatedPng = validPng.subarray(0, validPng.length - 12);
    const fetchImpl = async (url) => {
      if (String(url).includes("/Napa/TaxonMaps/Genus/County/Echinacea")) {
        return new Response('<a href="/MapGallery/County/Echinacea%20angustifolia.png">Echinacea angustifolia</a>', { status: 200 });
      }
      if (String(url).endsWith("Echinacea%20angustifolia.png")) {
        return new Response(truncatedPng, { status: 200 });
      }
      throw new Error(`Unexpected BONAP map URL: ${url}`);
    };

    await expect(fetchBonapMapSnapshots({
      plants: {
        "echinacea-angustifolia": {
          id: "echinacea-angustifolia",
          scientificName: "Echinacea angustifolia",
        },
      },
      taxonMatches: [{ plantId: "echinacea-angustifolia", matchStatus: "exact" }],
      fetchImpl,
    })).rejects.toThrow(/BONAP county map is not a complete PNG image/);
  });

  it("emits map evidence only for approved exact-taxonomy current reviews tied to the map hash", () => {
    const plant = { id: "echinacea-angustifolia", scientificName: "Echinacea angustifolia" };
    const snapshot = {
      mapUrl: "https://bonap.net/MapGallery/County/Echinacea%20angustifolia.png",
      sha256: "a".repeat(64),
      retrievedAt: "2026-10-01T12:00:00.000Z",
      etag: '"etag"',
      lastModified: "Fri, 19 May 2017 00:00:00 GMT",
      mapGenerationDate: "2014-12-14",
    };
    const baseReview = {
      plantId: plant.id,
      scientificName: plant.scientificName,
      mapUrl: snapshot.mapUrl,
      mapSha256: snapshot.sha256,
      mapGenerationDateFromContent: "2014-12-14",
      taxonomyMatch: "exact",
      mapScopeDecision: "confirmed_taxon_scope",
      reviewStatus: "approved",
      currentStatusConfirmed: true,
      reviewer: "native-data-reviewer",
      reviewedAt: "2026-10-01T12:00:00.000Z",
      reviewNote: "Reviewed the linked image and MapKey.",
      counties: [
        { countyFips: "27053", rawCategory: "Native" },
        { countyFips: "27123", rawCategory: "Native Historic" },
        { countyFips: "27139", rawCategory: "rare" },
      ],
    };
    const records = buildBonapCountyEvidence({
      plants: { [plant.id]: plant },
      mapSnapshots: [snapshot],
      reviews: [baseReview],
      source: { licenseNote: "Permission confirmed with attribution." },
    });
    expect(records.map((record) => [record.countyFips, record.nativityStatus])).toEqual([
      ["27053", "native"],
      ["27123", "not_native"],
      ["27139", "unknown"],
    ]);
    expect(records[0]).toMatchObject({
      sourceUrl: snapshot.mapUrl,
      releaseOrObservationDate: "2014-12-14",
      bonapReview: {
        mapSha256: snapshot.sha256,
        mapKeyUrl: BONAP_URLS.mapKey,
        rawCategory: "Native",
        taxonomyMatch: "exact",
        mapScopeDecision: "confirmed_taxon_scope",
        reviewStatus: "approved",
        currentStatusConfirmed: true,
      },
    });
    expect(buildBonapCountyEvidence({
      plants: { [plant.id]: plant },
      mapSnapshots: [snapshot],
      reviews: [{ ...baseReview, taxonomyMatch: "ambiguous" }],
      source: { licenseNote: "Permission confirmed with attribution." },
    })).toEqual([]);
    const infraspecificScopeRecords = buildBonapCountyEvidence({
      plants: { [plant.id]: plant },
      mapSnapshots: [snapshot],
      reviews: [{ ...baseReview, mapScopeDecision: "may_conflate_infraspecific" }],
      source: { licenseNote: "Permission confirmed with attribution." },
    });
    expect(infraspecificScopeRecords[0]).toMatchObject({
      countyFips: "27053",
      nativityStatus: "unknown",
      bonapReview: {
        rawCategory: "Native",
        mapScopeDecision: "may_conflate_infraspecific",
      },
    });
    expect(infraspecificScopeRecords[0].uncertainty).toMatch(/does not confirm that county colors apply specifically/);
    expect(buildBonapCountyEvidence({
      plants: { [plant.id]: plant },
      mapSnapshots: [snapshot],
      reviews: [{ ...baseReview, mapSha256: "b".repeat(64) }],
      source: { licenseNote: "Permission confirmed with attribution." },
    })).toEqual([]);
  });
});
