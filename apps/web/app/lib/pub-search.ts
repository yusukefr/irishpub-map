import type { Pub } from "@irishpub-map/shared/pub";

export function filterPubsByQuery(pubs: Pub[], query: string) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return pubs;
  }

  return pubs.filter((pub) =>
    [pub.name, pub.prefecture, pub.city].some((field) => normalizeSearchText(field).includes(normalizedQuery))
  );
}

function normalizeSearchText(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}
