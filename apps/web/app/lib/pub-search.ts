import type { Pub, PubStatus } from "@irishpub-map/shared/pub";

export type PubFilters = {
  query?: string;
  prefecture?: string;
  tag?: string;
  status?: PubStatus | "";
};

export function filterPubs(pubs: Pub[], filters: PubFilters) {
  const normalizedQuery = normalizeSearchText(filters.query ?? "");

  return pubs.filter((pub) => {
    const matchesQuery =
      !normalizedQuery ||
      [pub.name, pub.prefecture, pub.city].some((field) => normalizeSearchText(field).includes(normalizedQuery));
    const matchesPrefecture = !filters.prefecture || pub.prefecture === filters.prefecture;
    const matchesTag = !filters.tag || pub.tags.includes(filters.tag);
    const matchesStatus = !filters.status || pub.status === filters.status;

    return matchesQuery && matchesPrefecture && matchesTag && matchesStatus;
  });
}

export function filterPubsByQuery(pubs: Pub[], query: string) {
  return filterPubs(pubs, { query });
}

export function getAvailablePrefectures(pubs: Pub[]) {
  return [...new Set(pubs.map((pub) => pub.prefecture))].sort((a, b) => a.localeCompare(b));
}

export function getAvailableTags(pubs: Pub[]) {
  return [...new Set(pubs.flatMap((pub) => pub.tags))].sort((a, b) => a.localeCompare(b));
}

export function getAvailableStatuses(pubs: Pub[]) {
  return [...new Set(pubs.map((pub) => pub.status))].sort((a, b) => a.localeCompare(b));
}

function normalizeSearchText(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}
