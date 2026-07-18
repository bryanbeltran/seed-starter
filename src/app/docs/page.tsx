"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ApiDocsPage() {
  useEffect(() => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SwaggerUIBundle = (window as any).SwaggerUIBundle;
      if (!SwaggerUIBundle) return;
      SwaggerUIBundle({
        url: "/api/openapi",
        dom_id: "#swagger-ui",
      });
    };
    document.body.appendChild(script);
  }, []);

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="border-b px-4 py-3">
        <Link href="/" className="text-sm text-neutral-600 hover:underline">
          ← Seed Starter
        </Link>
        <h1 className="text-xl font-semibold mt-1">API Docs</h1>
        <p className="text-sm text-neutral-600">
          OpenAPI 3 ·{" "}
          <a className="underline" href="/api/openapi">
            /api/openapi
          </a>
        </p>
      </div>
      <div id="swagger-ui" />
    </main>
  );
}
