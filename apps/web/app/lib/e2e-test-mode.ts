/** E2E fixture mode must never be enabled for a Vercel production deployment. */
const PRODUCTION_FIXTURE_ERROR = "E2E test mode is not available in production.";

/**
 * サーバー側のE2E fixtureモードが有効かを返します。本番環境での有効化は即座に拒否します。
 * @returns {boolean} テスト専用fixtureを使用する場合はtrue。
 */
export function isE2ETestMode(): boolean {
  if (process.env.E2E_TEST_MODE !== "1") return false;
  if (process.env.VERCEL_ENV === "production") throw new Error(PRODUCTION_FIXTURE_ERROR);
  return true;
}

/**
 * E2E fixtureを含む読み取り用データソースが利用可能かを返します。
 * @returns {boolean} DBまたはE2E fixtureを利用できる場合はtrue。
 */
export function isDataSourceConfigured(): boolean {
  return isE2ETestMode() || Boolean(process.env.DATABASE_URL);
}

/**
 * E2E fixtureモードで永続化処理が呼ばれた場合に、DBへ到達する前に拒否します。
 * @returns {void} 通常モードでは何も行いません。
 */
export function rejectE2ETestMutation(): void {
  if (isE2ETestMode()) throw new Error("Mutations are disabled in E2E test mode.");
}
