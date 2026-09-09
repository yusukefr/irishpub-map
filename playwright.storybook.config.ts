import { defineConfig, devices } from "@playwright/test";

// 実アプリとは別に全Primitiveの任意状態を、ビルド済みCSSを含めて検証します。
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.storybook.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never", outputFolder: "playwright-report/storybook" }]],
  use: { baseURL: "http://localhost:6006", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build-storybook && npx vite preview --outDir storybook-static --port 6006 --strictPort",
    url: "http://localhost:6006",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
