import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_API_KEY_COUNT, DEFAULT_OUTPUT_PATH, MAX_API_KEY_COUNT, generateApiKeys, parseArguments, parseCount } from "../scripts/generate-api-keys.mjs";

const scriptPath = resolve(process.cwd(), "scripts/generate-api-keys.mjs");

describe("generate-api-keys", () => {
  it("uses a safe default and validates the requested count", () => {
    expect(parseCount([])).toBe(DEFAULT_API_KEY_COUNT);
    expect(parseCount(["3"])).toBe(3);
    expect(parseArguments([])).toEqual({ count: DEFAULT_API_KEY_COUNT, outputPath: DEFAULT_OUTPUT_PATH });
    expect(parseArguments(["3", "/tmp/api-keys.txt"])).toEqual({ count: 3, outputPath: "/tmp/api-keys.txt" });
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

  it("writes one key per line without logging keys", async () => {
    const directory = await mkdtemp(join(tmpdir(), "irishpub-map-api-keys-"));
    const outputPath = join(directory, "api-keys.txt");

    try {
      const output = execFileSync(process.execPath, [scriptPath, "3", outputPath], { encoding: "utf8" });
      const apiKeys = (await readFile(outputPath, "utf8")).trim().split("\n");

      expect(output).toBe("");
      expect(apiKeys).toHaveLength(3);
      expect(apiKeys.every((apiKey) => /^ipm_[A-Za-z0-9_-]{43}$/.test(apiKey))).toBe(true);
      expect((await stat(outputPath)).mode & 0o777).toBe(0o600);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
