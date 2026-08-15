import pubs from "../../../../data/pubs.json";
import { asPubs } from "@irishpub-map/shared/pub";

/**
 * フォールバック用JSONを共有スキーマで検証して返します。
 * @returns {Pub[]} 共通スキーマで検証済みの店舗一覧。
 */
export function getValidatedPubs() {
  return asPubs(pubs);
}
