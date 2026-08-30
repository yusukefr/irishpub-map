import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppHeader } from "../../apps/web/app/components/app-header";

describe("AppHeader", () => {
  it("keeps the page heading and language switcher in the compact header", () => {
    render(<AppHeader locale="en" />);

    expect(screen.getByRole("heading", { level: 1, name: "Irish Pub Map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Language: English" })).toBeInTheDocument();
  });
});
