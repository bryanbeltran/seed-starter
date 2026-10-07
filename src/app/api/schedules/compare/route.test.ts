import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/schedules/compare", () => {
  it("returns 400 when empty crop selections override seeds", async () => {
    const req = new Request("http://localhost/api/schedules/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip: "55423", seeds: ["tomato"], cropSelections: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Select at least one crop." });
  });

  it("returns three risk profiles", async () => {
    const req = new Request("http://localhost/api/schedules/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip: "55423", seeds: ["tomato"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conservative.riskProfile).toBe("conservative");
    expect(body.balanced.riskProfile).toBe("balanced");
    expect(body.aggressive.riskProfile).toBe("aggressive");
  });
});
