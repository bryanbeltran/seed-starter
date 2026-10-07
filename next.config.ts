import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sql.js"],
  outputFileTracingIncludes: {
    "/api/natives": [
      "./data/natives/plant-range-evidence.json",
      "./data/natives/native-source-ingestion.json",
      "./data/natives/zcta-catalog.json",
    ],
  },
};

export default nextConfig;
