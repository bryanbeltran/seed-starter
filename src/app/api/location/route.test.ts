import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/location", () => {
  it("returns zone and frost preview for fixture zip", async () => {
    const res = await GET(new Request("http://localhost/api/location?zip=55423"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.zone).toBe("5a");
    expect(body.lastFrostP50).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.lastSpringFrostP50).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.firstFallFrostP50).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.frostSource).toBeTruthy();
  });

  it("rejects invalid zip", async () => {
    const res = await GET(new Request("http://localhost/api/location?zip=abc"));
    expect(res.status).toBe(400);
  });
});
