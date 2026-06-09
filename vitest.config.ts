import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/planning/**",
        "src/lib/**",
        "src/persistence/**",
        "src/components/seed-form/buildICS.ts",
      ],
      exclude: ["src/**/*.test.ts", "src/lib/utils.ts"],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
