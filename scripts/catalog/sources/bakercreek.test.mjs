import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collect, listUrls } from "./bakercreek.mjs";

let root;

afterEach(() => {
  vi.unstubAllGlobals();
  if (root) fs.rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe("Baker Creek catalog discovery", () => {
  it("follows Shopify product sitemaps from the sitemap index", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "bakercreek-test-"));
    const requested = [];

    vi.stubGlobal("fetch", async (url) => {
      requested.push(url);
      if (url === "https://www.rareseeds.com/sitemap.xml") {
        return new Response(
          "<sitemapindex><sitemap><loc>https://www.rareseeds.com/sitemap_products_1.xml?from=1&amp;to=2</loc></sitemap></sitemapindex>",
        );
      }
      if (url === "https://www.rareseeds.com/sitemap_products_1.xml?from=1&to=2") {
        return new Response(
          "<urlset><url><loc>https://www.rareseeds.com/products/cherokee-purple-tomato</loc></url></urlset>",
        );
      }
      throw new Error(`unexpected request: ${url}`);
    });

    await expect(listUrls(root, { limit: 1 })).resolves.toEqual([
      "https://www.rareseeds.com/products/cherokee-purple-tomato",
    ]);
    expect(requested).toEqual([
      "https://www.rareseeds.com/sitemap.xml",
      "https://www.rareseeds.com/sitemap_products_1.xml?from=1&to=2",
    ]);
  });

  it("paces product requests to one at a time with a one-second gap", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "bakercreek-test-"));
    const handles = ["tomato-test-one", "tomato-test-two", "tomato-test-three"];
    const requestTimes = [];
    let inFlight = 0;
    let maxInFlight = 0;

    vi.stubGlobal("fetch", async (url) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (url === "https://www.rareseeds.com/sitemap.xml") {
          return new Response(
            "<sitemapindex><sitemap><loc>https://www.rareseeds.com/sitemap_products_1.xml?from=1&amp;to=3</loc></sitemap></sitemapindex>",
          );
        }
        if (url === "https://www.rareseeds.com/sitemap_products_1.xml?from=1&to=3") {
          const locs = handles
            .map((handle) => `<loc>https://www.rareseeds.com/products/${handle}</loc>`)
            .join("");
          return new Response(`<urlset>${locs}</urlset>`);
        }
        if (url.includes("/products/")) {
          requestTimes.push(Date.now());
          return new Response('<h1 class="page-title">Test Tomato</h1>');
        }
        throw new Error(`unexpected request: ${url}`);
      } finally {
        inFlight -= 1;
      }
    });

    const rows = await collect(root, { limit: handles.length, refresh: true });

    expect(rows).toHaveLength(handles.length);
    expect(maxInFlight).toBe(1);
    expect(requestTimes).toHaveLength(handles.length);
    expect(requestTimes[1] - requestTimes[0]).toBeGreaterThanOrEqual(1_000);
    expect(requestTimes[2] - requestTimes[1]).toBeGreaterThanOrEqual(1_000);
  });
});
