import { createHash, randomUUID } from "node:crypto";
import { adminApiErrorResponse, getAdminJsonContentTypeError } from "./admin-api";
import { getAutomationApiAuthorizationError, type AutomationScope } from "./automation-auth";
import {
  claimAutomationKey,
  cleanupExpiredAutomationKeys,
  completeAutomationKey,
  insertAutomationAudit,
  releaseAutomationKey,
  takeOverStaleAutomationKey,
  type AuditEntry,
  type AutomationResourceType,
} from "./automation-reliability-repository";

type CreateOptions = {
  scope: AutomationScope;
  resourceType: AutomationResourceType;
  execute: (id: string) => Promise<Response>;
  recover: (id: string) => Promise<unknown | null>;
};

type MutationOptions = {
  scope: AutomationScope;
  resourceType: AutomationResourceType;
  resourceId: string | null;
  execute: () => Promise<Response>;
};

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizedPath(request: Request): string {
  const pathname = new URL(request.url).pathname;
  return pathname.length > 1 ? pathname.replace(/\/$/u, "") : pathname;
}

function auditPath(request: Request): string {
  return normalizedPath(request).replace(
    /^(\/api\/automation\/v1\/(?:content|quiz|pubs))\/[^/]+(\/publication)?$/u,
    "$1/:id$2",
  );
}

async function audit(entry: AuditEntry): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await insertAutomationAudit(entry);
  } catch {
    // Business Operationは既に成立し得るためrollbackしない。Request IDだけを運用ログへ残す。
    console.error("Automation audit insert failed", { requestId: entry.requestId });
  }
}

function withRequestId(response: Response, requestId: string): Response {
  response.headers.set("X-Request-Id", requestId);
  return response;
}

function resourceResponse(type: AutomationResourceType, value: unknown): Response {
  const field = type === "quiz" ? "question" : type;
  return Response.json({ [field]: value }, { status: 201 });
}

/**
 * Automation CreateのKey検証、DB claim、結果再生と監査を共通化します。
 * @param request - 認証済みCreate Request。
 * @param options - 既存Business Operationと回復用読み取り。
 * @returns 初回または再送のResponse。
 */
export async function handleAutomationCreate(request: Request, options: CreateOptions): Promise<Response> {
  const authorizationError = getAutomationApiAuthorizationError(request, options.scope);
  if (authorizationError) return authorizationError;
  const requestId = randomUUID();
  const path = normalizedPath(request);
  const baseAudit = {
    requestId,
    scope: options.scope,
    method: "POST",
    path,
    resourceType: options.resourceType,
    action: "create" as const,
  };
  const finish = async (response: Response, resourceId: string | null, shouldAudit = true) => {
    if (shouldAudit) {
      await audit({
        ...baseAudit,
        resourceId,
        result: response.ok ? "success" : "failure",
        statusCode: response.status,
      });
    }
    return withRequestId(response, requestId);
  };

  const key = request.headers.get("Idempotency-Key");
  if (key === null) return finish(adminApiErrorResponse("idempotency_key_required", 400), null);
  if (key.length === 0 || key.length > 128 || key.trim() !== key || /[\u0000-\u001f\u007f]/u.test(key)) {
    return finish(adminApiErrorResponse("invalid_idempotency_key", 400), null);
  }
  if (!process.env.DATABASE_URL) return finish(adminApiErrorResponse("database_unavailable", 503), null);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return finish(contentTypeError, null);
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return finish(adminApiErrorResponse("invalid_json", 400), null);
  }

  const keyHash = hash(key);
  const requestHash = hash(`POST\n${path}\n${canonicalJson(body)}`);
  const candidateId = randomUUID();
  let claim;
  try {
    await cleanupExpiredAutomationKeys();
    claim = await claimAutomationKey(keyHash, requestHash, "POST", path, options.resourceType, candidateId);
  } catch {
    return finish(adminApiErrorResponse("internal_error", 500), null);
  }
  const { record } = claim;
  if (record.request_hash !== requestHash) {
    return finish(adminApiErrorResponse("idempotency_conflict", 409), record.resource_id);
  }
  if (record.status === "completed") {
    return finish(
      Response.json(record.response_body, { status: record.status_code ?? 201 }),
      record.resource_id,
      false,
    );
  }
  if (!claim.claimed) {
    try {
      if (!(await takeOverStaleAutomationKey(record.id))) {
        return finish(adminApiErrorResponse("idempotency_in_progress", 409), record.resource_id, false);
      }
    } catch {
      return finish(adminApiErrorResponse("internal_error", 500), record.resource_id);
    }
  }

  const resourceId = record.resource_id;
  let response: Response;
  try {
    const existing = claim.claimed ? null : await options.recover(resourceId);
    response = existing === null ? await options.execute(resourceId) : resourceResponse(options.resourceType, existing);
  } catch {
    response = adminApiErrorResponse("internal_error", 500);
  }
  if (!response.ok) {
    try {
      const existing = await options.recover(resourceId);
      if (existing !== null) response = resourceResponse(options.resourceType, existing);
      else await releaseAutomationKey(record.id);
    } catch {
      // 保存済みか判定できない時はclaimを残し、重複作成を防ぐ。
      return finish(adminApiErrorResponse("internal_error", 500), resourceId);
    }
  }
  if (response.ok) {
    try {
      await completeAutomationKey(record.id, response.status, await response.clone().json());
    } catch {
      // 作成結果が不確定な場合はclaimを残し、後続Retryから同じIDを回復する。
      return finish(adminApiErrorResponse("internal_error", 500), resourceId);
    }
  }
  return finish(response, response.ok ? resourceId : null);
}

/**
 * Automation Update/Publicationの結果を機密情報抜きで監査します。
 * @param request - 変更Request。
 * @param options - Scope、Resourceと既存Route処理。
 * @returns Request IDを付けた既存Response。
 */
export async function handleAutomationMutation(request: Request, options: MutationOptions): Promise<Response> {
  const authorizationError = getAutomationApiAuthorizationError(request, options.scope);
  if (authorizationError) return authorizationError;
  const requestId = randomUUID();
  let action: AuditEntry["action"] = "update";
  if (options.scope.endsWith(":publish")) {
    action = "publish";
    try {
      const body: unknown = await request.clone().json();
      if (body !== null && typeof body === "object") {
        const value = body as Record<string, unknown>;
        if (value.isPublished === false || value.status === "draft") action = "unpublish";
      }
    } catch {
      // 不正JSONのResponseは既存RouteのValidationに任せる。
    }
  }
  let response: Response;
  try {
    response = await options.execute();
  } catch {
    response = adminApiErrorResponse("internal_error", 500);
  }
  await audit({
    requestId,
    scope: options.scope,
    method: request.method,
    path: auditPath(request),
    resourceType: options.resourceType,
    resourceId: options.resourceId,
    action,
    result: response.ok ? "success" : "failure",
    statusCode: response.status,
  });
  return withRequestId(response, requestId);
}
