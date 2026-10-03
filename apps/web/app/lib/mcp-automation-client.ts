const AUTOMATION_PREFIX = "/api/automation/v1/";
const REQUEST_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const FIELD_NAME_PATTERN = /^[A-Za-z0-9.[\]_-]{1,128}$/;
const ERROR_CODES = new Set([
  "unauthorized",
  "forbidden",
  "invalid_request",
  "invalid_json",
  "invalid_content_type",
  "invalid_prefecture_code",
  "validation_error",
  "not_found",
  "database_unavailable",
  "internal_error",
  "content_conflict",
  "content_not_found",
  "quiz_conflict",
  "quiz_not_found",
  "pub_not_found",
  "tag_conflict",
  "publication_requirements_not_met",
  "idempotency_key_required",
  "invalid_idempotency_key",
  "idempotency_conflict",
  "idempotency_in_progress",
]);
const FIELD_ERROR_CODES = new Set([
  "required",
  "too_long",
  "invalid_format",
  "invalid_type",
  "leading_or_trailing_space",
  "immutable",
]);

/** Secret を除いて MCP Tool に返せる Automation API Error です。 */
export type AutomationApiError = {
  errorCode: string;
  fieldErrors?: Record<string, string>;
  missingFields?: string[];
};

/** 共通 Client の成功または失敗結果です。 */
export type AutomationApiResult =
  | { ok: true; status: number; data: unknown; requestId?: string }
  | { ok: false; status: number; error: AutomationApiError; requestId?: string };

/** Automation API 呼び出しに必要な情報です。 */
export type AutomationApiRequest = {
  method: "GET" | "POST" | "PUT" | "PATCH";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  idempotencyKey?: string;
};

function validOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (
      (!local && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function safeRequestId(value: string | null): string | undefined {
  return value && REQUEST_ID_PATTERN.test(value) ? value : undefined;
}

/**
 * Automation API の機械可読エラーから、Secret を含まない既知フィールドだけを取り出します。
 * @param value - 未検証の JSON Response。
 * @returns 安全な Error Code と既知フィールド。
 */
export function parseAutomationApiError(value: unknown): AutomationApiError {
  if (!value || typeof value !== "object") return { errorCode: "invalid_response" };
  const source = value as Record<string, unknown>;
  const errorCode =
    typeof source.errorCode === "string" && ERROR_CODES.has(source.errorCode) ? source.errorCode : "invalid_response";
  const error: AutomationApiError = { errorCode };

  if (source.fieldErrors && typeof source.fieldErrors === "object" && !Array.isArray(source.fieldErrors)) {
    const fields = Object.entries(source.fieldErrors).filter(
      ([name, reason]) => FIELD_NAME_PATTERN.test(name) && typeof reason === "string" && FIELD_ERROR_CODES.has(reason),
    );
    if (fields.length) error.fieldErrors = Object.fromEntries(fields.slice(0, 50));
  }
  if (Array.isArray(source.missingFields)) {
    const fields = source.missingFields.filter(
      (item): item is string => typeof item === "string" && FIELD_NAME_PATTERN.test(item),
    );
    if (fields.length) error.missingFields = fields.slice(0, 50);
  }
  return error;
}

/**
 * MCP から Automation API のみにアクセスし、Bearer / Error / Request ID を共通処理します。
 * @param options - 審査済み Tool が指定する method、path、任意の本文と Idempotency-Key。
 * @returns Secret を含まない成功データまたは機械可読エラー。
 */
export async function requestAutomationApi(options: AutomationApiRequest): Promise<AutomationApiResult> {
  const origin = validOrigin(process.env.MCP_AUTOMATION_API_ORIGIN);
  const token = process.env.MCP_AUTOMATION_API_TOKEN;
  if (!origin || !token) return { ok: false, status: 503, error: { errorCode: "mcp_configuration_error" } };
  const target = new URL(options.path, origin);
  if (
    !options.path.startsWith(AUTOMATION_PREFIX) ||
    options.path.includes("?") ||
    options.path.includes("#") ||
    target.origin !== origin ||
    target.pathname !== options.path
  ) {
    return { ok: false, status: 400, error: { errorCode: "mcp_invalid_path" } };
  }
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) target.searchParams.set(key, value);
  }

  const headers = new Headers({ Authorization: `Bearer ${token}`, Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers.set("x-vercel-protection-bypass", process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
  }

  try {
    const response = await fetch(target, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const requestId = safeRequestId(response.headers.get("X-Request-Id"));
    if (!response.headers.get("Content-Type")?.includes("application/json")) {
      return { ok: false, status: response.status, error: { errorCode: "invalid_response" }, requestId };
    }
    const data: unknown = await response.json();
    if (response.ok) return { ok: true, status: response.status, data, requestId };
    return { ok: false, status: response.status, error: parseAutomationApiError(data), requestId };
  } catch {
    // Fetch の例外には URL や Header が含まれ得るため、Tool Result / Log へ転送しない。
    return { ok: false, status: 503, error: { errorCode: "automation_api_unavailable" } };
  }
}
