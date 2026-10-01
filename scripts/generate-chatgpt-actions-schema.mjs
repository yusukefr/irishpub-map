#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "docs/specs/openapi/openapi.yaml");
const redocly = join(root, "node_modules/.bin/redocly");

// 新しい Automation 操作は、意図せず ChatGPT に公開されないよう明示的なレビューを必須にする。
const tools = {
  "GET /api/automation/v1/master/prefectures": [
    "list_prefectures",
    "Read-only. Lists prefectures. Does not change draft or published state and does not delete data.",
  ],
  "GET /api/automation/v1/master/municipalities": [
    "list_municipalities",
    "Read-only. Lists municipalities; check prefectures first. Does not change draft or published state and does not delete data.",
  ],
  "GET /api/automation/v1/master/tags": [
    "list_tags",
    "Read-only. Lists existing tags before creating a tag or assigning tags to a pub. Does not change draft or published state and does not delete data.",
  ],
  "GET /api/automation/v1/master/statuses": [
    "list_pub_statuses",
    "Read-only. Lists valid pub statuses before creating or updating a pub. Does not change draft or published state and does not delete data.",
  ],
  "POST /api/automation/v1/tags": [
    "create_tag",
    "Write. Creates a tag after checking list_tags for duplicates. Requires Idempotency-Key. Does not publish or delete data.",
  ],
  "GET /api/automation/v1/content": [
    "list_content",
    "Read-only. Lists draft and published content before creating new content. Does not change publication state or delete data.",
  ],
  "GET /api/automation/v1/content/{id}": [
    "get_content",
    "Read-only. Gets a content item before updating or changing publication. Does not change publication state or delete data.",
  ],
  "POST /api/automation/v1/content": [
    "create_content",
    "Write. Creates a content draft. Check list_content first. Requires Idempotency-Key. Does not publish or delete data.",
  ],
  "PUT /api/automation/v1/content/{id}": [
    "update_content",
    "Write. Replaces editable content fields; read with get_content first. Preserves publication state and does not delete data.",
  ],
  "PATCH /api/automation/v1/content/{id}/publication": [
    "set_content_publication",
    "Write. Publishes or unpublishes content. Read with get_content first and verify publication requirements. Does not delete data.",
  ],
  "GET /api/automation/v1/quiz": [
    "list_quizzes",
    "Read-only. Lists draft and published quizzes before creating a quiz. Does not change publication state or delete data.",
  ],
  "GET /api/automation/v1/quiz/{id}": [
    "get_quiz",
    "Read-only. Gets a quiz before updating or changing publication. Does not change publication state or delete data.",
  ],
  "POST /api/automation/v1/quiz": [
    "create_quiz",
    "Write. Creates an unpublished quiz. Check list_quizzes first. Requires Idempotency-Key. Does not publish or delete data.",
  ],
  "PUT /api/automation/v1/quiz/{id}": [
    "update_quiz",
    "Write. Replaces editable quiz fields; read with get_quiz first. Preserves publication state and does not delete data.",
  ],
  "PATCH /api/automation/v1/quiz/{id}/publication": [
    "set_quiz_publication",
    "Write. Publishes or unpublishes a quiz. Read with get_quiz first and verify publication requirements. Does not delete data.",
  ],
  "GET /api/automation/v1/pubs": [
    "list_pubs",
    "Read-only. Searches draft and published pubs to check duplicates before creating a pub. Does not change publication state or delete data.",
  ],
  "GET /api/automation/v1/pubs/{id}": [
    "get_pub",
    "Read-only. Gets a pub before updating or changing publication. Does not change publication state or delete data.",
  ],
  "POST /api/automation/v1/pubs": [
    "create_pub",
    "Write. Creates an unpublished pub. Check list_pubs and master data first. Requires Idempotency-Key. Does not publish or delete data.",
  ],
  "PUT /api/automation/v1/pubs/{id}": [
    "update_pub",
    "Write. Replaces editable pub fields; read with get_pub and check master data first. Preserves publication state and does not delete data.",
  ],
  "PATCH /api/automation/v1/pubs/{id}/publication": [
    "set_pub_publication",
    "Write. Publishes or unpublishes a pub. Read with get_pub first and verify publication requirements. Does not delete data.",
  ],
};

/** 指定環境の Origin 以外を Server URL に含めない。 */
function parseOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("--origin must be an HTTPS origin without credentials, path, query, or fragment");
  }
  return url.origin;
}

/** 参照先の Components だけを残し、Admin 契約を生成物から除く。 */
function selectComponents(document) {
  const selected = { securitySchemes: {} };
  const pending = [document.paths];
  const bearer = document.components?.securitySchemes?.AutomationBearer;
  if (!bearer) throw new Error("AutomationBearer security scheme is missing");
  selected.securitySchemes.AutomationBearer = bearer;

  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      pending.push(...node);
      continue;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref") {
        const match = /^#\/components\/([^/]+)\/([^/]+)$/.exec(value);
        if (!match) throw new Error(`Unexpected reference: ${value}`);
        const [, section, name] = match;
        selected[section] ??= {};
        if (selected[section][name]) continue;
        const component = document.components?.[section]?.[name];
        if (!component) throw new Error(`Missing component: ${value}`);
        selected[section][name] = component;
        pending.push(component);
      } else {
        pending.push(value);
      }
    }
  }
  for (const section of Object.keys(selected)) {
    if (!Object.keys(selected[section]).length) delete selected[section];
  }
  return selected;
}

/** 元 OpenAPI の契約を保持し、公開操作と Tool 用の説明だけを限定する。 */
function createActionsSchema(document, origin) {
  const paths = {};
  const seen = new Set();
  for (const [path, methods] of Object.entries(document.paths)) {
    if (!path.startsWith("/api/automation/v1/")) continue;
    for (const [method, operation] of Object.entries(methods)) {
      if (!/^(get|post|put|patch|delete)$/i.test(method)) continue;
      const key = `${method.toUpperCase()} ${path}`;
      const metadata = tools[key];
      if (!metadata) throw new Error(`Automation operation needs explicit review: ${key}`);
      if (!operation["x-required-scope"] || !operation.security?.some((item) => "AutomationBearer" in item)) {
        throw new Error(`Missing scope or Bearer security: ${key}`);
      }
      const [operationId, guidance] = metadata;
      paths[path] ??= {};
      paths[path][method] = {
        ...operation,
        operationId,
        description:
          `${guidance} Required server-side scope: ${operation["x-required-scope"]}. ${operation.description ?? ""}`.trim(),
      };
      seen.add(key);
    }
    if (Object.keys(paths[path] ?? {}).length && methods.parameters) paths[path].parameters = methods.parameters;
  }
  for (const key of Object.keys(tools)) {
    if (!seen.has(key)) throw new Error(`Expected Automation operation is missing: ${key}`);
  }
  const result = {
    openapi: document.openapi,
    info: {
      ...document.info,
      title: "Irish Pub Map ChatGPT Actions",
      description: "Bearer-authenticated Automation API actions generated from the repository OpenAPI contract.",
    },
    servers: [{ url: origin }],
    tags: document.tags?.filter((tag) => tag.name.startsWith("Automation ")),
    paths,
  };
  result.components = selectComponents({ paths, components: document.components });
  return result;
}

function main() {
  const args = process.argv.slice(2);
  let origin;
  let output;
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] === "--origin") origin = parseOrigin(args[index + 1]);
    else if (args[index] === "--output") output = args[index + 1];
    else
      throw new Error(
        "Usage: node scripts/generate-chatgpt-actions-schema.mjs --origin https://<your-domain> [--output file.json]",
      );
  }
  if (!origin) throw new Error("--origin is required");

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "irishpub-actions-"));
  try {
    const bundled = join(temporaryDirectory, "openapi.json");
    execFileSync(redocly, ["bundle", source, "--output", bundled], { cwd: root, stdio: ["ignore", "ignore", "pipe"] });
    const schema = createActionsSchema(JSON.parse(readFileSync(bundled, "utf8")), origin);
    const json = `${JSON.stringify(schema, null, 2)}\n`;
    if (output) writeFileSync(output, json, { flag: "wx" });
    else process.stdout.write(json);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main();
