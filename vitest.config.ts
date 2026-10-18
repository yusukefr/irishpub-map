import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // Mobile's SDK React differs from React DOM's root React; tests render it through the root renderer.
      {
        find: /^react$/,
        replacement: fileURLToPath(new URL("./node_modules/react/index.js", import.meta.url)),
      },
      {
        find: /^maplibre-gl$/,
        replacement: fileURLToPath(new URL("./tests/mocks/maplibre-gl.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["packages/shared/src/**/*.{ts,tsx}", "apps/web/app/components/**/*.{ts,tsx}"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
