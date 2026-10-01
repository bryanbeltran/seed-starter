import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/natives", () => {
  it("reports missing local range evidence for 55423 without recommending catalog candidates", async () => {
    const res = await GET(new Request("http://localhost/api/natives?zip=55423"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ecoregion.id).toBe("51");
    expect(body.county.name).toBe("Hennepin");
    expect(body.riskProfile).toBe("balanced");
    expect(body.catalogCoverage).toBe("full");
    expect(body.rangeEvidenceCoverage).toMatchObject({
      status: "no_local_evidence",
      affirmativeCount: 0,
      notNativeCount: 0,
      unknownCount: 0,
    });
    expect(body.rangeEvidenceCoverage.catalogCandidateCount).toBeGreaterThan(0);
    expect(body.rangeEvidenceCoverage.missingCount).toBe(
      body.rangeEvidenceCoverage.catalogCandidateCount,
    );
    expect(body.plants).toEqual([]);
  });

  it("rejects invalid zip", async () => {
    const res = await GET(new Request("http://localhost/api/natives?zip=abc"));
    expect(res.status).toBe(400);
  });

  it("does not recommend High Plains catalog plants without local evidence", async () => {
    const res = await GET(new Request("http://localhost/api/natives?zip=80202"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ecoregion.id).toBe("25");
    expect(body.catalogCoverage).toBe("full");
    expect(body.rangeEvidenceCoverage.status).toBe("no_local_evidence");
    expect(body.plants).toEqual([]);
  });

  it("does not recommend Northeastern Coastal Zone catalog plants without local evidence", async () => {
    const res = await GET(new Request("http://localhost/api/natives?zip=10001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ecoregion.id).toBe("59");
    expect(body.rangeEvidenceCoverage.status).toBe("no_local_evidence");
    expect(body.plants).toEqual([]);
  });

  it("does not return fall sow tasks without local range evidence", async () => {
    const res = await GET(
      new Request("http://localhost/api/natives?zip=55423&season=fall"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.season).toBe("fall");
    expect(body.rangeEvidenceCoverage.status).toBe("no_local_evidence");
    expect(body.plants).toEqual([]);
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
