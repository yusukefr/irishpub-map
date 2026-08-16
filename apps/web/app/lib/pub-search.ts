import type { Pub, PubStatus } from "@irishpub-map/shared/pub";
import { PREFECTURES } from "@irishpub-map/shared/prefecture";
import { normalizeTags } from "@irishpub-map/shared/tag";

/**
 * 検索条件を表す任意の絞り込み項目です。
 */
export type PubFilters = {
  query?: string;
  prefecture?: string;
  tags?: string[];
  status?: PubStatus | "";
  includeClosed?: boolean;
};

/**
 * 現在地などの緯度・経度を表す座標です。
 */
export type Coordinates = {
  latitude: number;
  longitude: number;
};
const PREFECTURES_IN_JIS_ORDER = PREFECTURES.map(({ name }) => name);

/**
 * 指定された検索・絞り込み条件をすべて満たす店舗を返します。
 * @param {Pub[]} pubs - 絞り込み対象の店舗一覧。
 * @param {PubFilters} filters - 適用する検索・絞り込み条件。
 * @returns {Pub[]} 条件に一致する店舗一覧。
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
 * 市区町村コード順と副次キーで、店舗配列を決定的に並べ替えます。
 * @param {Pub[]} pubs - 並べ替える店舗一覧。
 * @returns {Pub[]} 市区町村コード順に並んだ新しい配列。
 */
export function sortPubsByMunicipalityCode(pubs: Pub[]) {
  return [...pubs].sort(comparePubsByMunicipalityCode);
}

/**
 * 店舗名・都道府県・市区町村を対象に、入力文字列で店舗を検索します。
 * @param {Pub[]} pubs - 絞り込み対象の店舗一覧。
 * @param {string} query - 店舗名などを検索する文字列。
 * @returns {Pub[]} 検索結果の店舗一覧。
 */
export function filterPubsByQuery(pubs: Pub[], query: string) {
  return filterPubs(pubs, { query });
}

/**
 * 店舗が登録されている都道府県だけをJIS都道府県コード順で返します。
 * @returns {string[]} 店舗が登録されている都道府県一覧。
 * @param {Pub[]} pubs - 絞り込み対象の店舗一覧。
 */
export function getAvailablePrefectures(pubs: Pub[]) {
  const availablePrefectures = new Set(pubs.map((pub) => pub.prefecture));

  return PREFECTURES_IN_JIS_ORDER.filter((prefecture) => availablePrefectures.has(prefecture));
}

/**
 * 現在地との近似距離が最短になる、登録店舗の都道府県を返します。
 * @param {Pub[]} pubs - 絞り込み対象の店舗一覧。
 * @param {Coordinates} coordinates - 距離計算の基準座標。
 * @returns {string} 最寄り店舗が属する都道府県、または空文字列。
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
 * 登録店舗で利用されているタグを重複なく並べて返します。
 * @returns {string[]} 利用中のタグ一覧。
 * @param {Pub[]} pubs - 絞り込み対象の店舗一覧。
 */
export function getAvailableTags(pubs: Pub[]) {
  return normalizeTags(pubs.flatMap((pub) => pub.tags)).sort((a, b) => a.localeCompare(b));
}

/**
 * 登録店舗で利用されている営業状態を重複なく並べて返します。
 * @returns {PubStatus[]} 利用中の営業状態一覧。
 * @param {Pub[]} pubs - 絞り込み対象の店舗一覧。
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
      .replace(/[\u30a1-\u30f6]/g, (character) => {
        return String.fromCharCode(character.charCodeAt(0) - 0x60);
      }) ?? ""
  );
}

function getSquaredDistance(origin: Coordinates, destination: Coordinates) {
  const latitudeDifference = destination.latitude - origin.latitude;
  // 経度1度の距離は緯度で変わるため、現在地の緯度で簡易補正します。
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
