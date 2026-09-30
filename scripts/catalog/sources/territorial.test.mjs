import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collect } from "./territorial.mjs";

let root;

afterEach(() => {
  vi.unstubAllGlobals();
  if (root) fs.rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe("Territorial catalog collection", () => {
  it("paces product requests to one at a time with a one-second gap", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "territorial-test-"));
    const handles = ["tomato-test-one", "tomato-test-two", "tomato-test-three"];
    const requestTimes = [];
    let inFlight = 0;
    let maxInFlight = 0;
    let lastProductRequestAt;
    let rateLimitResponses = 0;

    vi.stubGlobal("fetch", async (url) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (url.includes("sitemap_products_1.xml")) {
          const locs = handles
            .map((handle) => `<loc>https://territorialseed.com/products/${handle}</loc>`)
            .join("");
          return new Response(`<urlset>${locs}</urlset>`);
        }

        const requestedAt = Date.now();
        requestTimes.push(requestedAt);
        if (lastProductRequestAt != null && requestedAt - lastProductRequestAt < 1_000) {
          rateLimitResponses += 1;
          lastProductRequestAt = requestedAt;
          return new Response("rate limited", {
            status: 429,
            headers: { "retry-after": "0" },
          });
        }
        lastProductRequestAt = requestedAt;
        return new Response(JSON.stringify({
          title: "Test Tomato",
          tags: ["Class:SEEDS"],
          description: "",
        }));
      } finally {
        inFlight -= 1;
      }
    });

    const rows = await collect(root, { limit: handles.length, refresh: true });

    expect(rows).toHaveLength(handles.length);
    expect(maxInFlight).toBe(1);
    expect(rateLimitResponses).toBe(0);
    expect(requestTimes).toHaveLength(handles.length);
    expect(requestTimes[1] - requestTimes[0]).toBeGreaterThanOrEqual(1_000);
    expect(requestTimes[2] - requestTimes[1]).toBeGreaterThanOrEqual(1_000);
  });
});
