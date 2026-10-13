import { describe, expect, it } from "vitest";
import {
  isProductionEnvironment,
  isProductionReleaseConfigured,
  validateProductionEnvironment,
} from "../scripts/validate-production-env.mjs";

describe("validate-production-env", () => {
  it("identifies Vercel Production without exposing any value", () => {
    expect(isProductionEnvironment({ VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionEnvironment({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isProductionEnvironment({})).toBe(false);
  });

  const release = {
    APP_RELEASE_VERSION: "v0.1.65",
    APP_RELEASE_DATE: "2026-10-04T12:42:00+09:00",
    APP_RELEASE_GIT_SHA: "a".repeat(40),
  };

  it("requires complete release metadata only in Production", () => {
    expect(validateProductionEnvironment({ VERCEL_ENV: "production" })).toBe(false);
    expect(isProductionReleaseConfigured(release)).toBe(true);
    expect(
      validateProductionEnvironment({
        VERCEL_ENV: "production",
        ...release,
      }),
    ).toBe(true);
    expect(isProductionReleaseConfigured({ ...release, APP_RELEASE_DATE: "2026-10-04T12:42:01+09:00" })).toBe(false);
    expect(isProductionReleaseConfigured({ ...release, APP_RELEASE_GIT_SHA: "invalid" })).toBe(false);
    expect(validateProductionEnvironment({ VERCEL_ENV: "preview" })).toBe(true);
    expect(validateProductionEnvironment({})).toBe(true);
  });
});
