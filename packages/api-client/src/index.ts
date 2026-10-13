import { asPubs, type Locale, type Pub } from "@irishpub-map/shared";

/** 公開Pub APIが成功以外のHTTP statusを返したことを示します。 */
export class PubApiHttpError extends Error {
  readonly status: number;

  /**
   * 信頼できないResponse本文を保持せずにHTTPエラーを作成します。
   * @param {number} status - HTTP Responseのstatus。
   */
  constructor(status: number) {
    super(`Public Pub API request failed with status ${status}.`);
    this.name = "PubApiHttpError";
    this.status = status;
  }
}

/** 成功したHTTP ResponseのJSONまたはPubデータが不正なことを示します。 */
export class PubApiPayloadError extends Error {
  /**
   * Response本文を公開せずにPayloadエラーを作成します。
   * @param {string} message - Payload失敗を安全に説明する文言。
   * @param {unknown} cause - 任意のJSON parseまたはValidationエラー。
   */
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "PubApiPayloadError";
  }
}

/** 公開Pub一覧を取得するための設定です。 */
export type GetPubsOptions = {
  /** Public APIを提供するApplicationのOrigin。 */
  baseUrl: string | URL;
  /** APIへ要求する翻訳locale。 */
  locale: Locale;
  /** Fetchへ渡す任意のキャンセルsignal。 */
  signal?: AbortSignal;
  /** Fetch互換の通信手段。省略時はPlatform標準のFetchを使用します。 */
  fetch?: typeof fetch;
};

/**
 * 公開Pub一覧を取得し、共有validatorで実行時検証します。
 * @param {GetPubsOptions} options - API Origin、locale、および任意の通信設定。
 * @returns {Promise<Pub[]>} 検証済みの公開Pub一覧。
 * @throws {PubApiHttpError} Serverが成功以外のstatusを返した場合。
 * @throws {PubApiPayloadError} 成功Responseが不正なJSONまたはPubデータを含む場合。
 */
export async function getPubs({
  baseUrl,
  locale,
  signal,
  fetch: fetchImpl = globalThis.fetch,
}: GetPubsOptions): Promise<Pub[]> {
  const url = new URL("/api/pubs", baseUrl);
  url.searchParams.set("locale", locale);

  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw new PubApiHttpError(response.status);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new PubApiPayloadError("Public Pub API returned invalid JSON.", cause);
  }

  if (!payload || typeof payload !== "object" || !("pubs" in payload)) {
    throw new PubApiPayloadError("Public Pub API returned an invalid payload.");
  }

  try {
    return asPubs(payload.pubs);
  } catch (cause) {
    throw new PubApiPayloadError("Public Pub API returned invalid Pub data.", cause);
  }
}
