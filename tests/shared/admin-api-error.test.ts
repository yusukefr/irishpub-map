import { describe, expect, it } from "vitest";
import {
  ADMIN_API_ERROR_CODES,
  ADMIN_FIELD_ERROR_CODES,
  isAdminApiErrorCode,
  isAdminFieldErrorCode,
} from "../../packages/shared/src/admin-api-error";

describe("admin API error codes", () => {
  it("derives API error validation from the exported code list", () => {
    for (const code of ADMIN_API_ERROR_CODES) expect(isAdminApiErrorCode(code)).toBe(true);
    expect(isAdminApiErrorCode("rate_limited")).toBe(false);
    expect(isAdminApiErrorCode(null)).toBe(false);
  });

  it("derives field error validation from the exported code list", () => {
    for (const code of ADMIN_FIELD_ERROR_CODES) expect(isAdminFieldErrorCode(code)).toBe(true);
    expect(isAdminFieldErrorCode("unknown")).toBe(false);
    expect(isAdminFieldErrorCode({})).toBe(false);
  });
});
