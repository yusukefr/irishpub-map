import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "../../apps/web/app/api/admin/login/route";
import { POST as logout } from "../../apps/web/app/api/admin/logout/route";
import { getAdminApiAuthorizationError } from "../../apps/web/app/lib/admin-api";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../../apps/web/app/lib/admin-auth";

const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;
const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const requestOrigin = "https://example.com";

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "test-only-session-secret";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = "test-only-hash";
});

afterEach(() => {
  if (originalSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = originalSessionSecret;
  if (originalAdminUsername === undefined) delete process.env.ADMIN_USERNAME;
  else process.env.ADMIN_USERNAME = originalAdminUsername;
  if (originalPasswordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = originalPasswordHash;
});

function authenticatedRequest(method: string, origin?: string) {
  const session = createAdminSession("admin");
  return new Request(`${requestOrigin}/api/admin/pubs`, {
    method,
    headers: {
      cookie: `${ADMIN_SESSION_COOKIE}=${session}`,
      ...(origin ? { origin } : {}),
    },
  });
}

describe("admin API request validation", () => {
  it("allows authenticated read requests without an Origin header", () => {
    expect(getAdminApiAuthorizationError(authenticatedRequest("GET"))).toBeNull();
  });

  it.each([undefined, "https://attacker.example"])(
    "rejects authenticated mutation requests with a missing or mismatched Origin: %s",
    (origin) => {
      const response = getAdminApiAuthorizationError(authenticatedRequest("POST", origin));

      expect(response?.status).toBe(403);
    },
  );

  it("allows authenticated mutation requests with an exact Origin match", () => {
    expect(getAdminApiAuthorizationError(authenticatedRequest("POST", requestOrigin))).toBeNull();
  });

  it("applies Origin validation to login and logout", async () => {
    const loginResponse = await login(
      new Request(`${requestOrigin}/api/admin/login`, {
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "unused" }),
      }),
    );
    const logoutResponse = logout(new Request(`${requestOrigin}/api/admin/logout`, { method: "POST" }));

    expect(loginResponse.status).toBe(403);
    expect(logoutResponse.status).toBe(403);
  });

  it("allows same-origin logout", () => {
    const response = logout(
      new Request(`${requestOrigin}/api/admin/logout`, { method: "POST", headers: { origin: requestOrigin } }),
    );

    expect(response.status).toBe(200);
  });
});
