import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/natives", () => {
  it("returns evidence-backed candidates for 55423", async () => {
    const res = await GET(new Request("http://localhost/api/natives?zip=55423"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ecoregion.id).toBe("51");
    expect(body.county.name).toBe("Hennepin");
    expect(body.riskProfile).toBe("balanced");
    expect(body.catalogCoverage).toBe("full");
    expect(body.rangeEvidenceCoverage).toMatchObject({
      status: "affirmative_evidence",
      affirmativeCount: body.rangeEvidenceCoverage.catalogCandidateCount,
      notNativeCount: 0,
      unknownCount: 0,
      missingCount: 0,
    });
    expect(body.rangeEvidenceCoverage.catalogCandidateCount).toBeGreaterThan(0);
    expect(body.plants.length).toBe(body.rangeEvidenceCoverage.catalogCandidateCount);
  });

  it("rejects invalid zip", async () => {
    const res = await GET(new Request("http://localhost/api/natives?zip=abc"));
    expect(res.status).toBe(400);
  });

  it("returns evidence-backed High Plains candidates", async () => {
    const res = await GET(new Request("http://localhost/api/natives?zip=80202"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ecoregion.id).toBe("25");
    expect(body.catalogCoverage).toBe("full");
    expect(body.rangeEvidenceCoverage.status).toBe("affirmative_evidence");
    expect(body.rangeEvidenceCoverage.missingCount).toBe(0);
    expect(body.plants.length).toBe(body.rangeEvidenceCoverage.catalogCandidateCount);
  });

  it("returns evidence-backed Northeastern Coastal Zone candidates", async () => {
    const res = await GET(new Request("http://localhost/api/natives?zip=10001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ecoregion.id).toBe("59");
    expect(body.rangeEvidenceCoverage.status).toBe("affirmative_evidence");
    expect(body.rangeEvidenceCoverage.missingCount).toBe(0);
    expect(body.plants.length).toBe(body.rangeEvidenceCoverage.catalogCandidateCount);
  });

  it("returns fall sow tasks for evidence-backed candidates", async () => {
    const res = await GET(
      new Request("http://localhost/api/natives?zip=55423&season=fall"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.season).toBe("fall");
    expect(body.rangeEvidenceCoverage.status).toBe("affirmative_evidence");
    expect(body.plants.length).toBeGreaterThan(0);
    expect(body.plants.every((plant: { tasks: { type: string }[] }) =>
      plant.tasks.every((task) => task.type === "fall_sow"),
    )).toBe(true);
  });

  it("honors riskProfile query", async () => {
    const res = await GET(
      new Request(
        "http://localhost/api/natives?zip=55423&riskProfile=conservative",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.riskProfile).toBe("conservative");
  });
});
