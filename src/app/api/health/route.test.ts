import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns ok status", async () => {
    const res = await GET(new Request("http://localhost/api/health"));
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.crops).toBeGreaterThanOrEqual(50);
    expect(body.varieties).toBeGreaterThanOrEqual(2000);
    expect(body.climate.zipCount).toBeGreaterThan(30_000);
    expect(body.persistence).toMatch(/sqlite|postgres/);
  });
});
