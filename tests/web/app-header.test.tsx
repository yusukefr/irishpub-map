import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppHeader } from "../../apps/web/app/components/app-header";

describe("AppHeader", () => {
  it("renders the home link and language switcher without a page heading", () => {
    render(<AppHeader locale="en" />);

    expect(screen.queryByRole("heading", { level: 1, name: "Irish Pub Map" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Irish Pub Map" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Language: English" })).toBeInTheDocument();
  });

  it("accepts optional internal navigation items without client pathname state", () => {
    render(
      <AppHeader locale="en" navigationItems={[{ href: "/discover", label: "Explore Ireland", current: true }]} />,
    );

    expect(screen.getByRole("navigation", { name: "Global navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Ireland" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "Explore Ireland" })).toHaveAttribute("aria-current", "page");
  });
});
