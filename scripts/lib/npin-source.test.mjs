import { describe, expect, it } from "vitest";
import {
  fetchNpinEnrichment,
  isNpinChallenge,
  matchNpinTaxon,
  parseNpinAutocomplete,
  parseNpinProfileFields,
} from "./npin-source.mjs";

const plant = { id: "echinacea-angustifolia", scientificName: "Echinacea angustifolia" };

describe("NPIN source adapter", () => {
  it("parses JSON-shaped autocomplete content without relying on its content type", () => {
    expect(parseNpinAutocomplete(`[{"cn":"Narrow-leaf purple coneflower","sn":"Echinacea angustifolia","genus":"Echinacea","value":"ECAN2"}]`)).toEqual([{
      commonName: "Narrow-leaf purple coneflower",
      scientificName: "Echinacea angustifolia",
      genus: "Echinacea",
      npinId: "ECAN2",
      evidenceUse: "taxon_crosswalk_only",
    }]);
  });

  it("requires an exact whole-name match and keeps profile IDs NPIN-scoped", () => {
    const rows = parseNpinAutocomplete([
      { cn: "Coneflower", sn: "Echinacea angustifolia", genus: "Echinacea", value: "ECAN2" },
      { cn: "Other", sn: "Echinacea angustifolia", genus: "Echinacea", value: "ECAN3" },
    ]);
    expect(matchNpinTaxon(plant.scientificName, rows).status).toBe("ambiguous");
    expect(matchNpinTaxon("Echinacea angustifolia var. strigosa", rows).status).toBe("unresolved");
  });

  it("extracts profile field enrichment without interpreting range as county nativity", () => {
    const parsed = parseNpinProfileFields(`
      <dl>
        <dt>Distribution</dt><dd>North America: IL, MN, WI</dd>
        <dt>Native Distribution</dt><dd>Central United States; Great Plains</dd>
        <dt>Native Habitat</dt><dd>Prairies and open woods</dd>
      </dl>`);
    expect(parsed).toEqual({
      fields: {
        distribution: "North America: IL, MN, WI",
        nativeDistribution: "Central United States; Great Plains",
        nativeHabitat: "Prairies and open woods",
      },
      evidenceUse: "profile_enrichment_only",
      nativityResolution: "none",
    });
    expect(parsed.fields).not.toHaveProperty("countyFips");
  });

  it("recognizes challenge pages for an unavailable profile without bypassing them", async () => {
    const responses = [];
    const fetchImpl = async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("autocomplete-data.php")) {
        responses.push("autocomplete");
        return new Response(JSON.stringify([
          { cn: "Narrow-leaf purple coneflower", sn: plant.scientificName, genus: "Echinacea", value: "ECAN2" },
        ]), { status: 200, headers: { "content-type": "text/html" } });
      }
      responses.push("profile");
      return new Response("<title>Just a moment...</title><div class=cf-chl-widget>challenge-platform</div>", {
        status: 403,
        headers: { "content-type": "text/html" },
      });
    };
    const snapshot = await fetchNpinEnrichment({
      plants: { [plant.id]: plant },
      fetchImpl,
      now: new Date("2026-10-01T12:00:00.000Z"),
    });
    expect(isNpinChallenge(403, "cloudflare challenge-platform")).toBe(true);
    expect(snapshot.enrichments[0]).toMatchObject({
      matchStatus: "exact",
      profileStatus: "challenge",
      profileHttpStatus: 403,
      fields: null,
      nativityResolution: "none",
      evidenceUse: "profile_unavailable",
    });
    expect(responses).toEqual(["autocomplete", "profile"]);
  });

  it("records accessible profile enrichment from the authorized route", async () => {
    const fetchImpl = async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("autocomplete-data.php")) {
        return new Response(JSON.stringify([
          { cn: "Narrow-leaf purple coneflower", sn: plant.scientificName, genus: "Echinacea", value: "ECAN2" },
        ]), { status: 200, headers: { "content-type": "text/html" } });
      }
      expect(parsed.pathname).toBe("/plants/result.php");
      expect(parsed.searchParams.get("id_plant")).toBe("ECAN2");
      return new Response("<dl><dt>Distribution</dt><dd>TX, OK, KS</dd><dt>Native Habitat</dt><dd>Prairie</dd></dl>", {
        status: 200,
        headers: { etag: '"profile"', "last-modified": "Wed, 01 Oct 2025 00:00:00 GMT" },
      });
    };
    const snapshot = await fetchNpinEnrichment({ plants: { [plant.id]: plant }, fetchImpl });
    expect(snapshot.enrichments[0]).toMatchObject({
      profileStatus: "available",
      autocomplete: { npinId: "ECAN2" },
      fields: { distribution: "TX, OK, KS", nativeHabitat: "Prairie" },
      nativityResolution: "none",
      profileEtag: '"profile"',
    });
  });

  it.each(["autocomplete", "profile"])(
    "rejects a cross-host %s redirect before requesting its target",
    async (redirectAt) => {
      const requests = [];
      const fetchImpl = async (url, options = {}) => {
        const parsed = new URL(url);
        requests.push({ url: parsed.href, redirect: options.redirect });
        if (redirectAt === "autocomplete" || parsed.pathname.endsWith("result.php")) {
          return new Response(null, {
            status: 302,
            headers: { location: "https://unapproved.example/internal" },
          });
        }
        return new Response(JSON.stringify([
          { cn: "Narrow-leaf purple coneflower", sn: plant.scientificName, genus: "Echinacea", value: "ECAN2" },
        ]), { status: 200 });
      };

      await expect(fetchNpinEnrichment({ plants: { [plant.id]: plant }, fetchImpl }))
        .rejects.toThrow(/NPIN (autocomplete|profile) redirect target URL is outside the approved HTTPS wildflower.org hosts/);
      expect(requests).toHaveLength(redirectAt === "autocomplete" ? 1 : 2);
      expect(requests.every(({ redirect }) => redirect === "manual")).toBe(true);
      expect(requests.every(({ url }) => new URL(url).hostname.endsWith("wildflower.org"))).toBe(true);
    },
  );
});
