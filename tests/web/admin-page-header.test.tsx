// 共通Page Headerの見出し階層、補足文、主要操作のAPIを保証します。
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminPageHeader } from "../../apps/web/app/components/admin-page-header";

describe("AdminPageHeader", () => {
  it("renders the section label, page heading, description and primary action", () => {
    render(
      <AdminPageHeader
        sectionLabel="ADMIN / CALENDAR"
        title="Calendar"
        description="Manage Irish Calendar events."
        actions={<button type="button">Add event</button>}
      />,
    );

    expect(screen.getByText("ADMIN / CALENDAR")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByText("Manage Irish Calendar events.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add event" })).toBeInTheDocument();
  });

  it("omits optional description and actions", () => {
    render(<AdminPageHeader sectionLabel="ADMIN / PUBS" title="Pubs" />);

    expect(screen.getByRole("heading", { level: 1, name: "Pubs" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
