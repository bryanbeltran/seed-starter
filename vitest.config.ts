import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: [
        "src/planning/**",
        "src/lib/**",
        "src/persistence/**",
        "src/components/seed-form/buildICS.ts",
        "src/components/seed-form/formState.ts",
        "src/components/seed-form/taskUtils.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/lib/utils.ts",
        "src/lib/ownerAuth.ts",
        "src/lib/observability.ts",
        "src/persistence/postgresSavedPlans.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
