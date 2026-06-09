import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/schedules", () => {
  it("returns schedule for valid fixture zip", async () => {
    const req = new Request("http://localhost/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip: "55423", seeds: ["tomato"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.zone).toBe("5a");
    expect(body.tasks.length).toBeGreaterThan(1);
  });

  it("returns 400 for invalid zip", async () => {
    const req = new Request("http://localhost/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip: "bad", seeds: ["tomato"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when no crops selected", async () => {
    const req = new Request("http://localhost/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip: "55423", seeds: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
