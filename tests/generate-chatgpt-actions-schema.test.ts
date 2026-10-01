import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const generator = join(root, "scripts/generate-chatgpt-actions-schema.mjs");
const directory = mkdtempSync(join(tmpdir(), "irishpub-actions-test-"));
const output = join(directory, "actions.json");

type Operation = {
  operationId: string;
  description: string;
  security: Array<Record<string, string[]>>;
  parameters?: Array<{ $ref?: string; name?: string }>;
  responses: Record<string, unknown>;
  "x-required-scope": string;
};

type Schema = {
  servers: Array<{ url: string }>;
  paths: Record<string, Record<string, Operation>>;
  components: {
    securitySchemes: Record<string, unknown>;
    parameters: Record<string, { name: string }>;
    schemas: Record<string, { properties?: Record<string, unknown> }>;
  };
};

let schema: Schema;

beforeAll(() => {
  execFileSync(process.execPath, [generator, "--origin", "https://example.test", "--output", output], { cwd: root });
  schema = JSON.parse(readFileSync(output, "utf8")) as Schema;
});

afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("ChatGPT Actions schema", () => {
  it("exposes only reviewed Automation operations and the intended HTTPS server", () => {
    expect(schema.servers).toEqual([{ url: "https://example.test" }]);
    expect(Object.keys(schema.paths)).toHaveLength(14);
    expect(Object.keys(schema.paths).every((path) => path.startsWith("/api/automation/v1/"))).toBe(true);
    expect(Object.keys(schema.components.securitySchemes)).toEqual(["AutomationBearer"]);

    const operations = Object.values(schema.paths).flatMap((path) =>
      Object.entries(path).filter(([method]) => ["get", "post", "put", "patch"].includes(method)),
    ) as Array<[string, Operation]>;
    expect(operations).toHaveLength(20);
    expect(new Set(operations.map(([, operation]) => operation.operationId)).size).toBe(20);
    for (const [method, operation] of operations) {
      expect(operation.security).toEqual([{ AutomationBearer: [] }]);
      expect(operation.description).toContain(`Required server-side scope: ${operation["x-required-scope"]}`);
      expect(operation.description).toContain("delete");
      expect(operation.description).toContain(method === "get" ? "Read-only" : "Write");
      expect(operation.responses).toHaveProperty("401");
      expect(operation.responses).toHaveProperty("403");
    }
  });

  it("retains error detail and idempotency contracts for write tools", () => {
    for (const path of ["content", "quiz", "pubs", "tags"]) {
      const operation = schema.paths[`/api/automation/v1/${path}`].post;
      expect(
        operation.parameters?.some((parameter) => {
          const name = parameter.$ref?.split("/").at(-1);
          return name
            ? schema.components.parameters[name]?.name === "Idempotency-Key"
            : parameter.name === "Idempotency-Key";
        }),
      ).toBe(true);
      expect(operation.responses).toHaveProperty("409");
      expect(operation.responses).toHaveProperty("422");
    }
    expect(
      Object.values(schema.components.schemas).some(
        (item) => item.properties?.errorCode && item.properties.fieldErrors && item.properties.missingFields,
      ),
    ).toBe(true);
  });

  it("rejects non-HTTPS URLs and URLs that change the API base path", () => {
    for (const origin of ["http://example.test", "https://example.test/admin"]) {
      expect(() =>
        execFileSync(process.execPath, [generator, "--origin", origin], {
          cwd: root,
          stdio: "ignore",
        }),
      ).toThrow();
    }
  });
});
