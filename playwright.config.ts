import { scryptSync } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { E2E_ADMIN_CREDENTIALS } from "./e2e/support/test-values";

const port = 3100;
const passwordSalt = "irishpub-map-e2e-only";
const passwordHash = scryptSync(E2E_ADMIN_CREDENTIALS.password, passwordSalt, 64).toString("base64");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "ja-JP",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -w apps/web -- -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      E2E_TEST_MODE: "1",
      ADMIN_USERNAME: E2E_ADMIN_CREDENTIALS.username,
      ADMIN_PASSWORD_HASH: `${passwordSalt}:${passwordHash}`,
      ADMIN_SESSION_SECRET: "irishpub-map-e2e-session-only",
    },
  },
});
