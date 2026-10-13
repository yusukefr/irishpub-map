import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@irishpub-map/shared/locale";

describe("Mobile shared package integration", () => {
  it("imports the supported locales from the shared workspace", () => {
    expect(SUPPORTED_LOCALES).toEqual(["ja", "en"]);
  });
});
