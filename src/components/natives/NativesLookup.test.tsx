import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativesLookup } from "./NativesLookup";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

type EvidenceFixture = {
  sourceId: string;
  sourceCitation: string;
  sourceUrl: string;
  releaseOrObservationDate: string | null;
  retrievedAt: string | null;
  licenseNote: string | null;
  geographicScope: string | null;
  spatialResolution: "county" | "finer";
  countyFips: string | null;
  finerArea?: { geography: "census-zcta-2010"; zctaId: string };
  nativityStatus: "native" | "not_native" | "unknown";
  uncertainty: null;
};

type ConflictFixture = {
  plantId: string;
  commonName: string;
  scientificName: string;
  claims: EvidenceFixture[];
  recommended: boolean;
};

const countyEvidence: EvidenceFixture[] = ["27053", "27123"].map((countyFips) => ({
  sourceId: "bonap-napa",
  sourceCitation: `BONAP current Native county category for FIPS ${countyFips}.`,
  sourceUrl: "https://bonap.net/MapGallery/County/Echinacea%20purpurea.png",
  releaseOrObservationDate: "2014-12-14",
  retrievedAt: "2026-10-01T12:00:00.000Z",
  licenseNote: "Owner-authorized BONAP use with attribution.",
  geographicScope: `County FIPS ${countyFips}.`,
  spatialResolution: "county",
  countyFips,
  nativityStatus: "native",
  uncertainty: null,
}));

function lookupPayload(
  rangeEvidence: EvidenceFixture[] = countyEvidence,
  options: {
    rangeEvidenceConflicts?: ConflictFixture[];
    rangeEvidenceCoverage?: Partial<{
      status: string;
      affirmativeCount: number;
      notNativeCount: number;
      conflictCount: number;
      unknownCount: number;
      unknownCountyCount: number;
      evidenceSourceIds: string[];
      affirmativeSourceIds: string[];
      notNativeSourceIds: string[];
    }>;
    plants?: unknown[];
  } = {},
) {
  return {
    zip: "55423",
    zone: "4b",
    season: "spring",
    riskProfile: "balanced",
    ecoregion: { id: "51", name: "Northern Glaciated Plains" },
    county: { fips: "27053", name: "Hennepin", state: "MN" },
    lastFrostDate: "2027-05-01",
    frostSource: "county climate normals",
    catalogCoverage: "full",
    rangeEvidenceCoverage: {
      status: "affirmative_evidence",
      catalogCandidateCount: 1,
      affirmativeCount: 1,
      notNativeCount: 0,
      conflictCount: 0,
      unknownCount: 0,
      unknownCountyCount: 0,
      missingCount: 0,
      countyIntersectionCount: 2,
      evidenceSourceIds: ["bonap-napa"],
      affirmativeSourceIds: ["bonap-napa"],
      notNativeSourceIds: [],
      ...options.rangeEvidenceCoverage,
    },
    rangeEvidenceConflicts: options.rangeEvidenceConflicts ?? [],
    plants: options.plants ?? [{
      id: "echinacea-purpurea",
      commonName: "Purple Coneflower",
      scientificName: "Echinacea purpurea",
      habit: "forb",
      needsStratification: false,
      sourceUrl: "https://plants.usda.gov/home/plantProfile?symbol=ECPU",
      confidence: "high",
      rangeEvidence,
      rangeEvidenceConflicts: [],
      tasks: [{ type: "direct_sow", date: "2027-04-01", label: "Direct sow Purple Coneflower" }],
    }],
  };
}

describe("NativesLookup range evidence", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => lookupPayload(),
    }));
  });

  it("attributes a BONAP recommendation to both counties in a multi-county ZIP", async () => {
    const user = userEvent.setup();
    render(<NativesLookup />);

    await user.type(screen.getByLabelText(/zip code/i), "55423");
    await user.click(screen.getByRole("button", { name: /find native plants/i }));

    expect(await screen.findByText(/BONAP NAPA across all 2 county intersections for this ZIP/i)).toBeInTheDocument();
    expect(screen.getByText(/covering every intersecting county/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /BONAP NAPA county-range evidence/i })).toHaveLength(2);
    expect(screen.getByText(/county FIPS 27053/)).toBeInTheDocument();
    expect(screen.getByText(/county FIPS 27123/)).toBeInTheDocument();
  });

  it("identifies direct ZCTA-wide evidence without calling it county-range evidence", async () => {
    const user = userEvent.setup();
    const finerEvidence: EvidenceFixture = {
      ...countyEvidence[0],
      sourceCitation: "BONAP current Native map status reviewed for Census 2010 ZCTA 55423.",
      geographicScope: "Census 2010 ZCTA 55423.",
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55423" },
    };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => lookupPayload([finerEvidence]),
    } as Response);

    render(<NativesLookup />);
    await user.type(screen.getByLabelText(/zip code/i), "55423");
    await user.click(screen.getByRole("button", { name: /find native plants/i }));

    expect(await screen.findByText(/directly covering this whole ZCTA/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /BONAP NAPA ZCTA-wide range evidence/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /county-range evidence/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/across all 2 county intersections/i)).not.toBeInTheDocument();
  });

  it("describes unknown county nativity as unknown without calling it a conflict", async () => {
    const user = userEvent.setup();
    const finerEvidence: EvidenceFixture = {
      ...countyEvidence[0],
      sourceId: "example-atlas",
      sourceCitation: "Example Botanical Atlas ZCTA range record.",
      sourceUrl: "https://flora.example/range-data/echinacea-purpurea",
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55423" },
    };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => lookupPayload([finerEvidence], {
        rangeEvidenceCoverage: {
          unknownCountyCount: 1,
          conflictCount: 0,
          evidenceSourceIds: ["bonap-napa", "example-atlas"],
        },
      }),
    } as Response);

    render(<NativesLookup />);
    await user.type(screen.getByLabelText(/zip code/i), "55423");
    await user.click(screen.getByRole("button", { name: /find native plants/i }));

    expect(await screen.findByText(/1 candidate\(s\) also have county nativity evidence with unknown status/i)).toBeInTheDocument();
    expect(screen.getByText(/Unknown evidence remains unclassified and is not counted as a conflicting claim/i)).toBeInTheDocument();
    expect(screen.queryByText(/opposing eligible nativity claims/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Conflicting nativity evidence" })).not.toBeInTheDocument();
  });

  it("shows same-county source disagreements and their provenance without recommending the plant", async () => {
    const user = userEvent.setup();
    const usdaNative: EvidenceFixture = {
      ...countyEvidence[0],
      sourceId: "usda-plants",
      sourceCitation: "USDA PLANTS County MapServer, county FIPS 27053.",
      sourceUrl:
        "https://apps.geo.fpac.usda.gov/nrcs-geodata/rest/services/plants/MapServer/6",
      releaseOrObservationDate: "2025-03-14",
    };
    const bonapHistoric: EvidenceFixture = {
      ...countyEvidence[0],
      sourceCitation: "BONAP NAPA Native Historic county category for FIPS 27053.",
      releaseOrObservationDate: "2014-12-14",
      nativityStatus: "not_native",
    };
    const payload = lookupPayload([], {
      plants: [],
      rangeEvidenceCoverage: {
        status: "no_local_evidence",
        affirmativeCount: 0,
        conflictCount: 1,
        unknownCount: 1,
        evidenceSourceIds: ["bonap-napa", "usda-plants"],
      },
      rangeEvidenceConflicts: [{
        plantId: "echinacea-purpurea",
        commonName: "Purple Coneflower",
        scientificName: "Echinacea purpurea",
        claims: [usdaNative, bonapHistoric],
        recommended: false,
      }],
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => payload,
    } as Response);

    render(<NativesLookup />);
    await user.type(screen.getByLabelText(/zip code/i), "55423");
    await user.click(screen.getByRole("button", { name: /find native plants/i }));

    expect(
      await screen.findByText(
        /1 candidate\(s\) have opposing eligible nativity claims within a county/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Conflicting nativity evidence" })).toBeInTheDocument();
    expect(screen.getByText("Not included in recommendations for this ZIP.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /USDA PLANTS county evidence/i })).toHaveAttribute(
      "href",
      usdaNative.sourceUrl,
    );
    expect(screen.getByRole("link", { name: /BONAP NAPA county evidence/i })).toHaveAttribute(
      "href",
      bonapHistoric.sourceUrl,
    );
    expect(
      screen.getByText(
        /county resolution · nativity native · county FIPS 27053 · source date 2025-03-14/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /county resolution · nativity not_native · county FIPS 27053 · source date 2014-12-14/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Direct sow Purple Coneflower")).not.toBeInTheDocument();
  });

  it("shows both sides of a negative whole-ZCTA and native county disagreement without recommending the plant", async () => {
    const user = userEvent.setup();
    const finerNotNative: EvidenceFixture = {
      ...countyEvidence[0],
      sourceId: "example-atlas",
      sourceCitation: "Example Botanical Atlas ZCTA range record.",
      sourceUrl: "https://flora.example/range-data/echinacea-purpurea",
      spatialResolution: "finer",
      countyFips: null,
      finerArea: { geography: "census-zcta-2010", zctaId: "55423" },
      nativityStatus: "not_native",
    };
    const countyNative: EvidenceFixture = {
      ...countyEvidence[0],
      sourceId: "usda-plants",
      sourceCitation: "USDA PLANTS County MapServer, county FIPS 27053.",
      sourceUrl: "https://apps.geo.fpac.usda.gov/nrcs-geodata/rest/services/plants/MapServer/6",
    };
    const payload = lookupPayload([], {
      plants: [],
      rangeEvidenceCoverage: {
        status: "not_native_evidence",
        affirmativeCount: 0,
        notNativeCount: 1,
        conflictCount: 1,
        evidenceSourceIds: ["example-atlas", "usda-plants"],
        affirmativeSourceIds: [],
        notNativeSourceIds: ["example-atlas"],
      },
      rangeEvidenceConflicts: [{
        plantId: "echinacea-purpurea",
        commonName: "Purple Coneflower",
        scientificName: "Echinacea purpurea",
        claims: [finerNotNative, countyNative],
        recommended: false,
      }],
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => payload,
    } as Response);

    render(<NativesLookup />);
    await user.type(screen.getByLabelText(/zip code/i), "55423");
    await user.click(screen.getByRole("button", { name: /find native plants/i }));

    expect(
      await screen.findByText(
        /1 candidate\(s\) have opposing eligible nativity claims within a county or between whole-ZCTA and county evidence/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Not included in recommendations for this ZIP.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /example-atlas whole-ZCTA evidence/i })).toHaveAttribute(
      "href",
      finerNotNative.sourceUrl,
    );
    expect(screen.getByRole("link", { name: /USDA PLANTS county evidence/i })).toHaveAttribute(
      "href",
      countyNative.sourceUrl,
    );
    expect(screen.getByText(/nativity not_native/)).toBeInTheDocument();
    expect(screen.getByText(/nativity native/)).toBeInTheDocument();
    expect(screen.queryByText("Direct sow Purple Coneflower")).not.toBeInTheDocument();
  });
});
