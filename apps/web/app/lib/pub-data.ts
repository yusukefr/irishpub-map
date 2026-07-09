import pubs from "../../../../data/pubs.json";
import { asPubs } from "@irishpub-map/shared/pub";

export function getValidatedPubs() {
  return asPubs(pubs);
}
