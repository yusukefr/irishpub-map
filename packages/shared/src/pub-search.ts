import type { Pub, PubStatus } from "./pub";
import { PREFECTURES } from "./prefecture";
import { normalizeTags } from "./tag";

/** Search conditions supported by the public pub explorer. */
export type PubFilters = {
  query?: string;
  prefecture?: string;
  tags?: string[];
  status?: PubStatus | "";
  includeClosed?: boolean;
};

/** Coordinates used by nearby-prefecture selection. */
export type Coordinates = {
  latitude: number;
  longitude: number;
};

/**
 * 指定された検索条件をすべて満たすPubを、市区町村コード順で返します。
 * @param {Pub[]} pubs - 絞り込み対象のPub一覧。
 * @param {PubFilters} filters - 適用する検索条件。
 * @returns {Pub[]} 条件に一致するPub一覧。
 */
export function filterPubs(pubs: Pub[], filters: PubFilters) {
  const normalizedQuery = normalizeSearchText(filters.query ?? "");
  const normalizedTags = normalizeTags(filters.tags ?? []);
  const filteredPubs = pubs.filter((pub) => {
    const matchesQuery =
      !normalizedQuery ||
      [pub.name, pub.kana, pub.prefecture, pub.city].some((field) =>
        normalizeSearchText(field).includes(normalizedQuery),
      );
    const matchesPrefecture = !filters.prefecture || pub.prefecture === filters.prefecture;
    const matchesTags = !normalizedTags.length || normalizedTags.every((tag) => pub.tags.includes(tag));
    const matchesStatus = matchesPubStatus(pub, filters);

    return matchesQuery && matchesPrefecture && matchesTags && matchesStatus;
  });

  return sortPubsByMunicipalityCode(filteredPubs);
}

function matchesPubStatus(pub: Pub, filters: PubFilters) {
  if (filters.includeClosed !== undefined) {
    return filters.includeClosed ? pub.status === "open" || pub.status === "closed" : pub.status === "open";
  }

  return !filters.status || pub.status === filters.status;
}

/**
 * Pubを市区町村コード順と安定した名前・ID順で並べ替えます。
 * @param {Pub[]} pubs - 並べ替えるPub一覧。
 * @returns {Pub[]} 並べ替えた新しい一覧。
 */
export function sortPubsByMunicipalityCode(pubs: Pub[]) {
  return [...pubs].sort(comparePubsByMunicipalityCode);
}

/**
 * Pub名、kana、都道府県、市区町村でPubを検索します。
 * @param {Pub[]} pubs - 検索対象のPub一覧。
 * @param {string} query - 検索文字列。
 * @returns {Pub[]} 検索文字列に一致するPub一覧。
 */
export function filterPubsByQuery(pubs: Pub[], query: string) {
  return filterPubs(pubs, { query });
}

/**
 * Pubが登録されている都道府県をJISコード順で返します。
 * @param {Pub[]} pubs - 対象のPub一覧。
 * @returns {string[]} 重複のない都道府県名。
 */
export function getAvailablePrefectures(pubs: Pub[]) {
  const available = new Map<string, number>();
  for (const pub of pubs) {
    const prefix = Number(pub.municipalityCode?.slice(0, 2));
    const order =
      prefix >= 1 && prefix <= 47
        ? prefix
        : (PREFECTURES.find(({ name }) => name === pub.prefecture)?.code ?? Infinity);
    available.set(pub.prefecture, Math.min(order, available.get(pub.prefecture) ?? Infinity));
  }
  return [...available]
    .sort(([nameA, orderA], [nameB, orderB]) => orderA - orderB || nameA.localeCompare(nameB, "ja"))
    .map(([name]) => name);
}

/**
 * 指定座標から最も近いPubが属する都道府県を返します。
 * @param {Pub[]} pubs - 対象のPub一覧。
 * @param {Coordinates} coordinates - 距離計算の基準座標。
 * @returns {string} 最寄りの都道府県名。Pubがなければ空文字列。
 */
export function getNearestAvailablePrefecture(pubs: Pub[], coordinates: Coordinates) {
  let nearestPrefecture = "";
  let shortestDistance = Number.POSITIVE_INFINITY;

  pubs.forEach((pub) => {
    const distance = getSquaredDistance(coordinates, pub);
    if (distance < shortestDistance) {
      nearestPrefecture = pub.prefecture;
      shortestDistance = distance;
    }
  });

  return nearestPrefecture;
}

/**
 * Pubで使われている正規化済みタグkeyを重複なく返します。
 * @param {Pub[]} pubs - 対象のPub一覧。
 * @returns {string[]} タグkey一覧。
 */
export function getAvailableTags(pubs: Pub[]) {
  return normalizeTags(pubs.flatMap((pub) => pub.tags)).sort((a, b) => a.localeCompare(b));
}

/**
 * Pubで使われている営業状態を重複なく返します。
 * @param {Pub[]} pubs - 対象のPub一覧。
 * @returns {PubStatus[]} 営業状態一覧。
 */
export function getAvailableStatuses(pubs: Pub[]) {
  return [...new Set(pubs.map((pub) => pub.status))].sort((a, b) => a.localeCompare(b));
}

function normalizeSearchText(value: string | null | undefined) {
  return (
    value
      ?.normalize("NFKC")
      .trim()
      .toLocaleLowerCase()
      .replace(/[\u30a1-\u30f6]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60)) ?? ""
  );
}

function getSquaredDistance(origin: Coordinates, destination: Coordinates) {
  const latitudeDifference = destination.latitude - origin.latitude;
  const longitudeScale = Math.cos((origin.latitude * Math.PI) / 180);
  const longitudeDifference = (destination.longitude - origin.longitude) * longitudeScale;
  return latitudeDifference ** 2 + longitudeDifference ** 2;
}

function comparePubsByMunicipalityCode(left: Pub, right: Pub) {
  const leftCode = left.municipalityCode ? Number(left.municipalityCode) : Number.POSITIVE_INFINITY;
  const rightCode = right.municipalityCode ? Number(right.municipalityCode) : Number.POSITIVE_INFINITY;
  if (leftCode !== rightCode) return leftCode - rightCode;
  return compareText(left.name, right.name) || compareText(left.kana, right.kana) || compareText(left.id, right.id);
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
  const leftText = left ?? "";
  const rightText = right ?? "";
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
}
