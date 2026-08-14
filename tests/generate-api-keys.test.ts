import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_API_KEY_COUNT, MAX_API_KEY_COUNT, generateApiKeys, parseCount } from "../scripts/generate-api-keys.mjs";

const scriptPath = resolve(process.cwd(), "scripts/generate-api-keys.mjs");

describe("generate-api-keys", () => {
  it("uses a safe default and validates the requested count", () => {
    expect(parseCount([])).toBe(DEFAULT_API_KEY_COUNT);
    expect(parseCount(["3"])).toBe(3);
    expect(() => parseCount(["0"])).toThrow(`between 1 and ${MAX_API_KEY_COUNT}`);
    expect(() => parseCount([String(MAX_API_KEY_COUNT + 1)])).toThrow(`between 1 and ${MAX_API_KEY_COUNT}`);
    expect(() => parseCount(["1", "2"])).toThrow("Usage:");
  });

  it("generates unique keys with the expected format", () => {
    const apiKeys = generateApiKeys(3);

    expect(new Set(apiKeys).size).toBe(3);
    expect(apiKeys).toHaveLength(3);
    for (const apiKey of apiKeys) expect(apiKey).toMatch(/^ipm_[A-Za-z0-9_-]{43}$/);
  });

  it("prints one key per line", () => {
    const output = execFileSync(process.execPath, [scriptPath, "3"], { encoding: "utf8" });
    const apiKeys = output.trim().split("\n");

    expect(apiKeys).toHaveLength(3);
    expect(apiKeys.every((apiKey) => /^ipm_[A-Za-z0-9_-]{43}$/.test(apiKey))).toBe(true);
  });
});
