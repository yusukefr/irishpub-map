import pubs from "../../../../data/pubs.json";
import { asPubs } from "@irishpub-map/shared/pub";

/** フォールバック用JSONを共有スキーマで検証して返します。 */
export function getValidatedPubs() {
  return asPubs(pubs);
}
