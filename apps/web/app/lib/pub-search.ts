import type { Pub, PubStatus } from "@irishpub-map/shared/pub";

/**
 * 検索条件を表す任意の絞り込み項目です。
 */
export type PubFilters = {
  query?: string;
  prefecture?: string;
  tags?: string[];
  status?: PubStatus | "";
};

/**
 * 現在地などの緯度・経度を表す座標です。
 */
export type Coordinates = {
  latitude: number;
  longitude: number;
};

const PREFECTURES_IN_JIS_ORDER = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
] as const;

/**
 * 指定された検索・絞り込み条件をすべて満たす店舗を返します。
 * @param {Pub[]} pubs - 絞り込み対象の店舗一覧。
 * @param {PubFilters} filters - 適用する検索・絞り込み条件。
 * @returns {Pub[]} 条件に一致する店舗一覧。
 */
export function filterPubs(pubs: Pub[], filters: PubFilters) {
  const normalizedQuery = normalizeSearchText(filters.query ?? "");

  return pubs.filter((pub) => {
    const matchesQuery =
      !normalizedQuery ||
      [pub.name, pub.kana, pub.prefecture, pub.city].some((field) =>
        normalizeSearchText(field).includes(normalizedQuery),
      );
    const matchesPrefecture = !filters.prefecture || pub.prefecture === filters.prefecture;
    const matchesTags = !filters.tags?.length || filters.tags.every((tag) => pub.tags.includes(tag));
    const matchesStatus = !filters.status || pub.status === filters.status;

    return matchesQuery && matchesPrefecture && matchesTags && matchesStatus;
  });
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
  return [...new Set(pubs.flatMap((pub) => pub.tags))].sort((a, b) => a.localeCompare(b));
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
