// @vitest-environment node
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { getMcpOAuthConfig, verifyMcpAccessToken, type McpOAuthConfig } from "../../apps/web/app/lib/mcp-auth";

const keys = [
  "MCP_PUBLIC_ORIGIN",
  "MCP_OAUTH_ISSUER",
  "MCP_OAUTH_AUDIENCE",
  "MCP_OAUTH_JWKS_URL",
  "MCP_OAUTH_ALLOWED_SUBJECT",
] as const;
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("MCP OAuth authentication", () => {
  it("fails closed when required configuration is absent", () => {
    for (const key of keys) delete process.env[key];
    expect(getMcpOAuthConfig()).toBeNull();
  });

  it("rejects an audience that differs from the advertised MCP resource", () => {
    process.env.MCP_PUBLIC_ORIGIN = "https://example.test";
    process.env.MCP_OAUTH_ISSUER = "https://issuer.example.test/";
    process.env.MCP_OAUTH_JWKS_URL = "https://issuer.example.test/jwks";
    process.env.MCP_OAUTH_ALLOWED_SUBJECT = "admin-subject";
    process.env.MCP_OAUTH_AUDIENCE = "https://another-resource.example.test/api/mcp";
    expect(getMcpOAuthConfig()).toBeNull();
  });

  it("keeps the configured issuer string without adding a trailing slash", () => {
    process.env.MCP_PUBLIC_ORIGIN = "https://example.test";
    process.env.MCP_OAUTH_ISSUER = "https://issuer.example.test";
    process.env.MCP_OAUTH_AUDIENCE = "https://example.test/api/mcp";
    process.env.MCP_OAUTH_JWKS_URL = "https://issuer.example.test/jwks";
    process.env.MCP_OAUTH_ALLOWED_SUBJECT = "admin-subject";
    expect(getMcpOAuthConfig()?.issuer).toBe("https://issuer.example.test");
  });

  it("accepts only a signed, current access token for the configured admin and resource", async () => {
    const config: McpOAuthConfig = {
      publicOrigin: "https://example.test",
      issuer: "https://issuer.example.test",
      audience: "https://example.test/api/mcp",
      jwksUrl: "https://issuer.example.test/jwks",
      allowedSubject: "admin-subject",
    };
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    const keySet = createLocalJWKSet({ keys: [{ ...jwk, kid: "test-key", alg: "RS256" }] });
    const sign = (subject: string, audience: string, issuer = config.issuer) =>
      new SignJWT({ scope: "mcp:read", client_id: "test-client" })
        .setProtectedHeader({ alg: "RS256", kid: "test-key" })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(subject)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);

    const accepted = await verifyMcpAccessToken(await sign(config.allowedSubject, config.audience), config, keySet);
    expect(accepted?.scopes).toEqual(["mcp:read"]);
    expect(accepted?.clientId).toBe("test-client");
    expect(await verifyMcpAccessToken(await sign("other-subject", config.audience), config, keySet)).toBeUndefined();
    expect(
      await verifyMcpAccessToken(
        await sign(config.allowedSubject, config.audience, `${config.issuer}/`),
        config,
        keySet,
      ),
    ).toBeUndefined();
    expect(
      await verifyMcpAccessToken(await sign(config.allowedSubject, "other-resource"), config, keySet),
    ).toBeUndefined();

    const now = Math.floor(Date.now() / 1000);
    const futureIssued = await new SignJWT({ scope: "mcp:read" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setSubject(config.allowedSubject)
      .setIssuedAt(now + 300)
      .setExpirationTime(now + 600)
      .sign(privateKey);
    expect(await verifyMcpAccessToken(futureIssued, config, keySet)).toBeUndefined();

    const expired = await new SignJWT({ scope: "mcp:read" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setSubject(config.allowedSubject)
      .setIssuedAt(now - 600)
      .setExpirationTime(now - 60)
      .sign(privateKey);
    expect(await verifyMcpAccessToken(expired, config, keySet)).toBeUndefined();

    const { privateKey: wrongKey } = await generateKeyPair("RS256");
    const wrongSignature = await new SignJWT({ scope: "mcp:read" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setSubject(config.allowedSubject)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(wrongKey);
    expect(await verifyMcpAccessToken(wrongSignature, config, keySet)).toBeUndefined();
  });
});
