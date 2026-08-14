import { describe, expect, it } from "vitest";
import {
  isProductionApiKeyConfigured,
  isProductionEnvironment,
  validateProductionEnvironment,
} from "../scripts/validate-production-env.mjs";

describe("validate-production-env", () => {
  it("identifies Vercel Production without exposing any value", () => {
    expect(isProductionEnvironment({ VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionEnvironment({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isProductionEnvironment({})).toBe(false);
  });

  it("requires a non-empty API key only in Production", () => {
    expect(isProductionApiKeyConfigured({ VERCEL_ENV: "production", IRISHPUB_MAP_API_KEY: "  " })).toBe(false);
    expect(validateProductionEnvironment({ VERCEL_ENV: "production" })).toBe(false);
    expect(validateProductionEnvironment({ VERCEL_ENV: "production", IRISHPUB_MAP_API_KEY: "test-only-api-key" })).toBe(
      true,
    );
    expect(validateProductionEnvironment({ VERCEL_ENV: "preview" })).toBe(true);
    expect(validateProductionEnvironment({})).toBe(true);
  });
});
