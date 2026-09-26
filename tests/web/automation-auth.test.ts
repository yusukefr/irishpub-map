import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAdminApiAuthorizationError } from "../../apps/web/app/lib/admin-api";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../../apps/web/app/lib/admin-auth";
import {
  authenticateAutomationRequest,
  authorizeAutomationScope,
  getAutomationApiAuthorizationError,
} from "../../apps/web/app/lib/automation-auth";

const token = "test-only-automation-token";
const tokenHash = createHash("sha256").update(token).digest("hex");
const originalTokenHash = process.env.AUTOMATION_API_TOKEN_SHA256;
const originalScopes = process.env.AUTOMATION_API_SCOPES;
const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;
const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH;

function request(authorization?: string, options?: { cookie?: string; method?: string; origin?: string }) {
  return new Request("https://example.com/api/automation/v1/content", {
    method: options?.method ?? "GET",
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(options?.cookie ? { cookie: options.cookie } : {}),
      ...(options?.origin ? { origin: options.origin } : {}),
    },
  });
}

beforeEach(() => {
  process.env.AUTOMATION_API_TOKEN_SHA256 = tokenHash;
  process.env.AUTOMATION_API_SCOPES = "content:read,content:create";
});

afterEach(() => {
  if (originalTokenHash === undefined) delete process.env.AUTOMATION_API_TOKEN_SHA256;
  else process.env.AUTOMATION_API_TOKEN_SHA256 = originalTokenHash;
  if (originalScopes === undefined) delete process.env.AUTOMATION_API_SCOPES;
  else process.env.AUTOMATION_API_SCOPES = originalScopes;
  if (originalSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = originalSessionSecret;
  if (originalAdminUsername === undefined) delete process.env.ADMIN_USERNAME;
  else process.env.ADMIN_USERNAME = originalAdminUsername;
  if (originalPasswordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = originalPasswordHash;
});

describe("Automation API authentication", () => {
  it.each([undefined, "Basic credentials", "Bearer", "Bearer ", "Bearer wrong-token", "Bearer token with-spaces"])(
    "returns only the public unauthorized code for invalid Authorization: %s",
    async (authorization) => {
      const response = getAutomationApiAuthorizationError(request(authorization), "content:read");
      expect(authenticateAutomationRequest(request(authorization))).toBeNull();
      expect(response?.status).toBe(401);
      expect(response?.headers.get("www-authenticate")).toBe("Bearer");
      const body = await response?.text();
      expect(JSON.parse(body ?? "")).toEqual({ errorCode: "unauthorized" });
      expect(body).not.toContain(token);
      expect(body).not.toContain(tokenHash);
    },
  );

  it.each([undefined, "", "abc", "g".repeat(64), "0".repeat(62)])(
    "fails closed when the configured SHA-256 is absent or malformed: %s",
    async (configuredHash) => {
      if (configuredHash === undefined) delete process.env.AUTOMATION_API_TOKEN_SHA256;
      else process.env.AUTOMATION_API_TOKEN_SHA256 = configuredHash;

      const response = getAutomationApiAuthorizationError(request(`Bearer ${token}`), "content:read");
      expect(response?.status).toBe(401);
      expect(response?.headers.get("www-authenticate")).toBe("Bearer");
      await expect(response?.json()).resolves.toEqual({ errorCode: "unauthorized" });
    },
  );

  it("compares SHA-256 digests for tokens of different lengths without throwing", () => {
    expect(authenticateAutomationRequest(request("Bearer x"))).toBeNull();
    expect(authenticateAutomationRequest(request(`Bearer ${"x".repeat(500)}`))).toBeNull();
    expect(authenticateAutomationRequest(request(`bearer ${token}`))).not.toBeNull();
  });

  it("accepts one or more spaces between the Bearer scheme and token", () => {
    expect(getAutomationApiAuthorizationError(request(`Bearer ${token}`), "content:read")).toBeNull();
    expect(getAutomationApiAuthorizationError(request(`Bearer  ${token}`), "content:read")).toBeNull();
    expect(getAutomationApiAuthorizationError(request(`Bearer   ${token}`), "content:read")).toBeNull();
  });

  it("returns a principal with exact, allow-listed scopes", () => {
    process.env.AUTOMATION_API_SCOPES = " content:read , content:create,unknown:scope,content:reader,,content:read ";
    const principal = authenticateAutomationRequest(request(`Bearer ${token}`));

    expect(principal?.scopes).toEqual(new Set(["content:read", "content:create"]));
    expect(authorizeAutomationScope(principal!, "content:read")).toBe(true);
    expect(authorizeAutomationScope(principal!, "content:update")).toBe(false);
  });

  it("returns forbidden only after a valid token lacks the required scope", async () => {
    process.env.AUTOMATION_API_SCOPES = "content:read";
    const response = getAutomationApiAuthorizationError(request(`Bearer ${token}`), "content:create");

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ errorCode: "forbidden" });
    expect(getAutomationApiAuthorizationError(request(`Bearer ${token}`), "content:read")).toBeNull();
  });

  it("treats absent and unknown scopes as empty permissions", async () => {
    process.env.AUTOMATION_API_SCOPES = "unknown:scope,content:reader";
    expect(authenticateAutomationRequest(request(`Bearer ${token}`))?.scopes.size).toBe(0);
    expect(getAutomationApiAuthorizationError(request(`Bearer ${token}`), "content:read")?.status).toBe(403);

    delete process.env.AUTOMATION_API_SCOPES;
    expect(authenticateAutomationRequest(request(`Bearer ${token}`))?.scopes.size).toBe(0);
  });

  it("keeps admin Cookie and Origin checks separate from Automation Bearer authentication", () => {
    process.env.ADMIN_SESSION_SECRET = "test-only-session-secret";
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = "test-only-hash";
    const cookie = `${ADMIN_SESSION_COOKIE}=${createAdminSession("admin")}`;

    expect(getAutomationApiAuthorizationError(request(undefined, { cookie }), "content:read")?.status).toBe(401);
    expect(
      getAutomationApiAuthorizationError(request(`Bearer ${token}`, { method: "POST" }), "content:create"),
    ).toBeNull();
    expect(getAdminApiAuthorizationError(request(`Bearer ${token}`))?.status).toBe(401);
    expect(getAdminApiAuthorizationError(request(undefined, { cookie, method: "POST" }))?.status).toBe(403);
    expect(
      getAdminApiAuthorizationError(request(undefined, { cookie, method: "POST", origin: "https://example.com" })),
    ).toBeNull();
  });
});

describe("Automation token generator", () => {
  it("generates a 256-bit random token and its matching SHA-256 for an interactive terminal", () => {
    // Child process内だけTTYを模擬し、生成されたSecretをテストログへ出しません。
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "Object.defineProperty(process.stdout, 'isTTY', { value: true }); process.argv.push('scripts/generate-automation-token.mjs'); await import('./scripts/generate-automation-token.mjs');",
      ],
      { encoding: "utf8" },
    );
    const lines = result.stdout.split("\n");
    const generatedToken = lines[1] ?? "";
    const generatedHash = lines[4] ?? "";

    expect(result.status).toBe(0);
    expect(generatedToken.startsWith("ipm_automation_v1_")).toBe(true);
    expect(Buffer.from(generatedToken.slice("ipm_automation_v1_".length), "base64url").length).toBe(32);
    expect(generatedHash === createHash("sha256").update(generatedToken).digest("hex")).toBe(true);
  });

  it("requires a terminal and does not disclose secrets in non-interactive output", () => {
    const result = spawnSync(process.execPath, ["scripts/generate-automation-token.mjs"], { encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("interactive terminal");
  });
});
