import { describe, expect, it } from "vitest";
import {
  ADMIN_STATUS_NAME_MAX_LENGTH,
  AdminStatusValidationError,
  parseUpdateAdminPubStatusInput,
} from "../../packages/shared/src/admin-status";

describe("admin status validation", () => {
  it("normalizes names and treats an empty English value as unregistered", () => {
    expect(parseUpdateAdminPubStatusInput({ key: "changed", nameJa: "  営業中  ", nameEn: " Open " })).toEqual({
      nameJa: "営業中",
      nameEn: "Open",
    });
    expect(parseUpdateAdminPubStatusInput({ nameJa: "営業中", nameEn: "   " })).toEqual({
      nameJa: "営業中",
      nameEn: null,
    });
  });

  it("rejects missing, blank, non-text, and overlong names with field codes", () => {
    expectValidation({ nameJa: " " }, { nameJa: "required" });
    expectValidation({ nameJa: "営業中", nameEn: 1 }, { nameEn: "invalid_type" });
    expectValidation(
      { nameJa: "あ".repeat(ADMIN_STATUS_NAME_MAX_LENGTH + 1), nameEn: "a".repeat(ADMIN_STATUS_NAME_MAX_LENGTH + 1) },
      { nameJa: "too_long", nameEn: "too_long" },
    );
  });
});

function expectValidation(value: unknown, fieldErrors: Record<string, string>) {
  try {
    parseUpdateAdminPubStatusInput(value);
    expect.fail("Validation should reject invalid status names.");
  } catch (error) {
    expect(error).toBeInstanceOf(AdminStatusValidationError);
    expect((error as AdminStatusValidationError).fieldErrors).toEqual(fieldErrors);
  }
}
