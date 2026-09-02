import { afterEach, describe, expect, it } from "vitest";
import {
  getE2EAdminPub,
  getE2EAdminPubPage,
  getE2EAdminTags,
  getE2EPublishedPubs,
} from "../../apps/web/app/lib/e2e-test-fixtures";
import { isDataSourceConfigured, isE2ETestMode, rejectE2ETestMutation } from "../../apps/web/app/lib/e2e-test-mode";

const originalE2EMode = process.env.E2E_TEST_MODE;
const originalVercelEnv = process.env.VERCEL_ENV;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  restoreEnvironment("E2E_TEST_MODE", originalE2EMode);
  restoreEnvironment("VERCEL_ENV", originalVercelEnv);
  restoreEnvironment("DATABASE_URL", originalDatabaseUrl);
});

describe("E2E test mode", () => {
  it("returns stable localized fixtures without a database", () => {
    process.env.E2E_TEST_MODE = "1";
    delete process.env.DATABASE_URL;

    expect(isE2ETestMode()).toBe(true);
    expect(isDataSourceConfigured()).toBe(true);
    expect(getE2EPublishedPubs("ja").map((pub) => pub.name)).toEqual(["E2E Irish Pub Nagoya", "E2E Irish Pub Tokyo"]);
    expect(getE2EAdminPubPage({ statusKey: "open", page: 1 }, "en")).toMatchObject({ total: 2, page: 1 });
    expect(getE2EAdminPub("30000000-0000-4000-8000-000000000001")?.translations.en?.address).toContain("Nagoya");
    expect(getE2EAdminTags()).toHaveLength(2);
  });

  it("rejects fixture mutations before a database can be used", () => {
    process.env.E2E_TEST_MODE = "1";

    expect(() => rejectE2ETestMutation()).toThrow("Mutations are disabled in E2E test mode.");
  });

  it("fails closed when fixture mode is enabled in Vercel production", () => {
    process.env.E2E_TEST_MODE = "1";
    process.env.VERCEL_ENV = "production";

    expect(() => isE2ETestMode()).toThrow("E2E test mode is not available in production.");
  });

  it("uses the database configuration outside fixture mode", () => {
    delete process.env.E2E_TEST_MODE;
    delete process.env.DATABASE_URL;
    expect(isDataSourceConfigured()).toBe(false);

    process.env.DATABASE_URL = "postgres://test-only";
    expect(isDataSourceConfigured()).toBe(true);
    expect(() => rejectE2ETestMutation()).not.toThrow();
  });
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
