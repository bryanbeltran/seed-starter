import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/natives", () => {
  it("returns native plants for 55423", async () => {
    const res = await GET(new Request("http://localhost/api/natives?zip=55423"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ecoregion.id).toBe("51");
    expect(body.catalogCoverage).toBe("full");
    expect(body.plants.length).toBeGreaterThanOrEqual(15);
    expect(body.plants[0].tasks[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects invalid zip", async () => {
    const res = await GET(new Request("http://localhost/api/natives?zip=abc"));
    expect(res.status).toBe(400);
  });

  it("returns none coverage for High Plains without catalog", async () => {
    const res = await GET(new Request("http://localhost/api/natives?zip=80202"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ecoregion.id).toBe("25");
    expect(body.catalogCoverage).toBe("none");
    expect(body.plants).toEqual([]);
  });
});
