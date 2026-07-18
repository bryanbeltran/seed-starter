import { NextResponse } from "next/server";
import { cropIds, varietyCount } from "@/planning";
import {
  getClimateZipCount,
  getCurrentClimateDataVersion,
} from "@/climate";
import climateManifest from "../../../../data/climate-manifest.json";
import { authEnabled } from "@/lib/ownerToken";
import { apiRoute } from "@/lib/apiRoute";
import { OUTLIER_DISTANCE_KM } from "@/lib/climateConfidence";

export const GET = apiRoute("health", async () => {
  return NextResponse.json({
    status: "ok",
    version: process.env.npm_package_version ?? "0.1.0",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    crops: cropIds.length,
    varieties: varietyCount(),
    climate: {
      dataVersion: getCurrentClimateDataVersion(),
      zipCount: getClimateZipCount(),
      manifest: climateManifest,
      outlierDistanceKm: OUTLIER_DISTANCE_KM,
    },
    persistence: process.env.DATABASE_URL ? "postgres" : "sqlite",
    auth: authEnabled() ? "owner-cookie" : "open",
  });
}, { limit: 120 });
