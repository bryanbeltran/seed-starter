import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listUrls } from "./bakercreek.mjs";

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
});
