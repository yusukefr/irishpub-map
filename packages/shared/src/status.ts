import type { PubStatus } from "./pub";

/** DBコード、外部値、表示名の対応を定義します。 */
export const PUB_STATUS_DEFINITIONS = [
  { code: 1, value: "open", displayName: "営業中" },
  { code: 2, value: "temporarily_closed", displayName: "一時休業" },
  { code: 3, value: "closed", displayName: "閉店" },
  { code: 4, value: "unknown", displayName: "不明" },
] as const satisfies readonly { code: number; value: PubStatus; displayName: string }[];

/**
 * 外部ステータス値から正規化スキーマ用のコードを取得します。
 * @param {PubStatus} value - 外部ステータス値。
 * @returns {number | undefined} 対応するDBコード。
 */
export function getPubStatusCode(value: PubStatus) {
  return PUB_STATUS_DEFINITIONS.find((status) => status.value === value)?.code;
}

/**
 * 正規化スキーマ用のステータスコードから外部値を取得します。
 * @param {number} code - DBステータスコード。
 * @returns {PubStatus | undefined} 対応する外部ステータス値。
 */
export function getPubStatusValue(code: number) {
  return PUB_STATUS_DEFINITIONS.find((status) => status.code === code)?.value;
}
