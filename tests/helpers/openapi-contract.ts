import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

const openApiRoot = path.resolve("docs/specs/openapi");
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

type OpenApiObject = Record<string, unknown>;

/** OpenAPI契約から指定Routeのoperationを取得し、ローカル参照を解決します。
 * @param routePath OpenAPI上のRoute Path。
 * @param method HTTP Method。
 * @returns 参照解決済みのOperation Object。
 */
export async function getOpenApiOperation(routePath: string, method: string): Promise<OpenApiObject> {
  const document = await readYaml(path.join(openApiRoot, "openapi.yaml"));
  const paths = document.paths as OpenApiObject;
  const pathItem = await resolveRefs(paths[routePath] as OpenApiObject, path.join(openApiRoot, "openapi.yaml"));
  const operation = pathItem[method.toLowerCase()];
  if (!operation || typeof operation !== "object")
    throw new Error(`OpenAPI operation not found: ${method} ${routePath}`);
  return operation as OpenApiObject;
}

/** 実RouteのResponseをOpenAPIのstatusとJSON Schemaで検証します。
 * @param response 実Route Handlerが返したResponse。
 * @param operation OpenAPI Operation Object。
 * @returns JSON Response body。
 */
export async function expectOpenApiResponse(response: Response, operation: OpenApiObject): Promise<unknown> {
  const responses = operation.responses as OpenApiObject;
  const responseContract = responses[String(response.status)] as OpenApiObject | undefined;
  if (!responseContract) {
    throw new Error(`OpenAPI response missing for ${operation.operationId ?? "route"}: HTTP ${response.status}`);
  }

  const contractHeaders = responseContract.headers as OpenApiObject | undefined;
  for (const [name, headerContract] of Object.entries(contractHeaders ?? {})) {
    const headerValue = response.headers.get(name);
    const headerSchema = (headerContract as OpenApiObject).schema as OpenApiObject | undefined;
    if (headerValue === null) {
      throw new Error(
        `OpenAPI response header missing for ${operation.operationId ?? "route"} HTTP ${response.status}: ${name}`,
      );
    }
    if (headerSchema && !ajv.validate(headerSchema, headerValue)) {
      const details = ajv.errorsText();
      throw new Error(
        `OpenAPI response header mismatch for ${operation.operationId ?? "route"} HTTP ${response.status} ${name}: ${details}`,
      );
    }
  }

  const content = responseContract.content as OpenApiObject | undefined;
  const jsonContract = content?.["application/json"] as OpenApiObject | undefined;
  if (!jsonContract) return undefined;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`Expected application/json for ${operation.operationId ?? "route"} HTTP ${response.status}`);
  }

  const body: unknown = await response.json();
  const schema = jsonContract.schema as OpenApiObject;
  const validate = ajv.compile(schema);
  if (!validate(body)) {
    throw new Error(formatValidationError(operation, response.status, validate));
  }
  return body;
}

async function readYaml(filePath: string): Promise<OpenApiObject> {
  return parse(await readFile(filePath, "utf8")) as OpenApiObject;
}

async function resolveRefs(value: unknown, sourceFile: string, ancestors = new Set<string>()): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map((item) => resolveRefs(item, sourceFile, ancestors)));
  if (!value || typeof value !== "object") return value;

  const object = value as OpenApiObject;
  if (typeof object.$ref === "string") {
    const [referenceFile, pointer = ""] = object.$ref.split("#", 2);
    const targetFile = referenceFile ? path.resolve(path.dirname(sourceFile), referenceFile) : sourceFile;
    if (targetFile !== openApiRoot && !targetFile.startsWith(`${openApiRoot}${path.sep}`)) {
      throw new Error(`OpenAPI reference escapes contract directory: ${object.$ref}`);
    }
    const target = referenceFile ? await readYaml(targetFile) : await readYaml(sourceFile);
    const pointerKey = `${targetFile}#${pointer}`;
    if (ancestors.has(pointerKey)) throw new Error(`Circular OpenAPI reference cannot be inlined: ${object.$ref}`);
    const nextAncestors = new Set(ancestors).add(pointerKey);
    let resolved: unknown = target;
    for (const segment of pointer.split("/").filter(Boolean)) {
      resolved = (resolved as OpenApiObject)[segment.replaceAll("~1", "/").replaceAll("~0", "~")];
    }
    const result = await resolveRefs(resolved, targetFile, nextAncestors);
    const siblings = Object.fromEntries(Object.entries(object).filter(([key]) => key !== "$ref"));
    return Object.keys(siblings).length
      ? { ...(result as OpenApiObject), ...((await resolveRefs(siblings, sourceFile, ancestors)) as OpenApiObject) }
      : result;
  }

  return Object.fromEntries(
    await Promise.all(
      Object.entries(object).map(async ([key, item]) => [key, await resolveRefs(item, sourceFile, ancestors)]),
    ),
  );
}

function formatValidationError(operation: OpenApiObject, status: number, validate: ValidateFunction): string {
  const details = validate.errors?.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
  return `OpenAPI response mismatch for ${operation.operationId ?? "route"} HTTP ${status}: ${details ?? "unknown schema error"}`;
}
