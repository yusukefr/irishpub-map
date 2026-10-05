import { describe, expect, it } from "vitest";
import { getReleaseInfo, parseReleaseInfo } from "../../apps/web/app/lib/release-info";

const metadata = {
  APP_RELEASE_VERSION: "v0.1.65",
  APP_RELEASE_DATE: "2026-10-04T12:42:00+09:00",
  APP_RELEASE_GIT_SHA: "a".repeat(40),
};

describe("release info", () => {
  it("validates and formats the same metadata for Public and Admin", () => {
    expect(parseReleaseInfo(metadata)).toEqual({
      version: "v0.1.65",
      releasedAt: "2026-10-04 12:42 JST",
      gitSha: "a".repeat(40),
    });
    expect(parseReleaseInfo({ ...metadata, APP_RELEASE_DATE: "2026-02-30T12:42:00+09:00" })).toBeNull();
    expect(parseReleaseInfo({ ...metadata, APP_RELEASE_GIT_SHA: "invalid" })).toBeNull();
  });

  it("uses safe Local and Preview labels and rejects incomplete Production metadata", () => {
    expect(getReleaseInfo({})).toEqual({ version: "dev", releasedAt: null, gitSha: null });
    expect(getReleaseInfo({ VERCEL_ENV: "preview" })).toEqual({ version: "preview", releasedAt: null, gitSha: null });
    expect(getReleaseInfo({ ...metadata, VERCEL_ENV: "preview" })).toEqual({
      version: "preview",
      releasedAt: null,
      gitSha: null,
    });
    expect(() => getReleaseInfo({ VERCEL_ENV: "production" })).toThrow("metadata is missing or invalid");
  });
});
