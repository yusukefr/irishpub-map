import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import appVersion from "../../app-version.json";
import { AppVersionFooter } from "../../apps/web/app/components/app-version-footer";

describe("AppVersionFooter", () => {
  it("renders the app version and release date from the version file", () => {
    render(<AppVersionFooter />);

    const versionInfo = screen.getByRole("contentinfo", { name: "アプリのバージョン情報" });
    expect(versionInfo).toHaveTextContent(`v${appVersion.version}`);
    expect(versionInfo).toHaveTextContent(`リリース日 ${appVersion.releaseDate}`);
  });
});
