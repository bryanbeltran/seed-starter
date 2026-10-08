import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * Load large generated native snapshots at server runtime instead of asking
 * the TypeScript/Vite JSON transformer to materialize tens of thousands of
 * literal records during every type-check and test import.
 */
export function readNativeJson<T>(relativePath: string): T {
  const filePath = path.join(process.cwd(), relativePath);
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function readNativeGzipJson<T>(relativePath: string): T {
  const filePath = path.join(process.cwd(), relativePath);
  return JSON.parse(gunzipSync(readFileSync(filePath)).toString("utf8")) as T;
}
