// デプロイ前に行うバージョン更新の種別、JST日付、ファイル出力を保証するテストです。
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bumpVersion, formatJstDate, updateAppVersion, updateReleaseDate } from "../scripts/update-app-version.mjs";

describe("update-app-version", () => {
  it("increments the patch version by default", () => {
    expect(bumpVersion("1.2.3")).toBe("1.2.4");
  });

  it("increments the minor version and resets patch for feature releases", () => {
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
  });

  it("formats dates in Japan Standard Time", () => {
    expect(formatJstDate(new Date("2026-08-12T15:00:00.000Z"))).toBe("2026-08-13");
  });

  it("updates the version file with the selected bump and JST release date", async () => {
    const directory = await mkdtemp(join(tmpdir(), "irishpub-map-version-"));
    const versionFile = join(directory, "app-version.json");
    await writeFile(versionFile, JSON.stringify({ version: "0.1.9", releaseDate: "2026-01-01" }));

    await updateAppVersion(versionFile, "minor", new Date("2026-08-12T15:00:00.000Z"));

    expect(JSON.parse(await readFile(versionFile, "utf8"))).toEqual({ version: "0.2.0", releaseDate: "2026-08-13" });
  });

  it("updates only the JST release date without changing the version", async () => {
    const directory = await mkdtemp(join(tmpdir(), "irishpub-map-version-date-"));
    const versionFile = join(directory, "app-version.json");
    await writeFile(versionFile, JSON.stringify({ version: "0.1.9", releaseDate: "2026-01-01" }));

    await updateReleaseDate(versionFile, new Date("2026-08-12T15:00:00.000Z"));

    expect(JSON.parse(await readFile(versionFile, "utf8"))).toEqual({ version: "0.1.9", releaseDate: "2026-08-13" });
  });

  it("rejects unsupported bump types and invalid versions", () => {
    expect(() => bumpVersion("1.2.3", "major")).toThrow("Unsupported version bump type");
    expect(() => bumpVersion("1.2", "patch")).toThrow("Invalid semantic version");
  });
});
