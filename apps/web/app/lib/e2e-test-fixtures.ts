import {
  ADMIN_PUB_PAGE_SIZE,
  type AdminPub,
  type AdminPubListItem,
  type AdminPubPage,
  type AdminPubSearchCondition,
} from "@irishpub-map/shared/admin-pub";
import type {
  MunicipalityOption,
  PrefectureOption,
  PubStatusOption,
  TagOption,
} from "@irishpub-map/shared/admin-master";
import type { AdminPubStatus } from "@irishpub-map/shared/admin-status";
import type { AdminTag } from "@irishpub-map/shared/admin-tag";
import type { Locale } from "@irishpub-map/shared/locale";
import type { Pub } from "@irishpub-map/shared/pub";

export const E2E_TEST_DATA = {
  pubs: {
    nagoya: { id: "30000000-0000-4000-8000-000000000001", name: "E2E Irish Pub Nagoya" },
    tokyo: { id: "30000000-0000-4000-8000-000000000002", name: "E2E Irish Pub Tokyo" },
  },
  tags: {
    guinness: { id: "30000000-0000-4000-8000-000000000101", key: "guinness" },
    whiskey: { id: "30000000-0000-4000-8000-000000000102", key: "whiskey" },
  },
} as const;

const UPDATED_AT = "2026-01-15T12:00:00.000Z";
const statusDefinitions = [
  { code: 1, key: "open", ja: "営業中", en: "Open" },
  { code: 3, key: "closed", ja: "閉店", en: "Closed" },
] as const;
const tagDefinitions = [
  { ...E2E_TEST_DATA.tags.guinness, ja: "ギネス", en: "Guinness" },
  { ...E2E_TEST_DATA.tags.whiskey, ja: "ウイスキー", en: "Whiskey" },
] as const;
const prefectureDefinitions = [
  { code: 23, ja: "愛知県", en: "Aichi" },
  { code: 13, ja: "東京都", en: "Tokyo" },
] as const;
const municipalityDefinitions = [
  { code: "231002", prefectureCode: 23, ja: "名古屋市", en: "Nagoya" },
  { code: "131016", prefectureCode: 13, ja: "千代田区", en: "Chiyoda" },
] as const;
const pubDefinitions = [
  {
    ...E2E_TEST_DATA.pubs.nagoya,
    kana: "イーツーイー アイリッシュ パブ ナゴヤ",
    prefectureCode: 23,
    municipalityCode: "231002",
    addressJa: "愛知県名古屋市テスト1-1",
    addressEn: "1-1 Test, Nagoya, Aichi",
    latitude: 35.1709,
    longitude: 136.8815,
    status: "open" as const,
    statusCode: 1,
    tagIds: [E2E_TEST_DATA.tags.guinness.id],
    isPublished: true,
  },
  {
    ...E2E_TEST_DATA.pubs.tokyo,
    kana: "イーツーイー アイリッシュ パブ トウキョウ",
    prefectureCode: 13,
    municipalityCode: "131016",
    addressJa: "東京都千代田区テスト2-2",
    addressEn: "2-2 Test, Chiyoda, Tokyo",
    latitude: 35.6812,
    longitude: 139.7671,
    status: "closed" as const,
    statusCode: 3,
    tagIds: [E2E_TEST_DATA.tags.whiskey.id],
    isPublished: true,
  },
] as const;

/**
 * E2Eで公開画面へ返す、選択localeに対応した固定店舗を生成します。
 * @param {Locale} locale - fixtureの表示ロケール。
 * @returns {Pub[]} 公開画面用の固定店舗。
 */
export function getE2EPublishedPubs(locale: Locale): Pub[] {
  return pubDefinitions.filter((pub) => pub.isPublished).map((pub) => toPublishedPub(pub, locale));
}

/**
 * E2Eで管理店舗一覧へ返す固定ページを、実画面と同じ検索条件で絞り込みます。
 * @param {AdminPubSearchCondition} condition - 管理画面の検索条件。
 * @param {Locale} locale - fixtureの表示ロケール。
 * @returns {AdminPubPage} 絞り込み済みの固定店舗ページ。
 */
export function getE2EAdminPubPage(condition: AdminPubSearchCondition, locale: Locale): AdminPubPage {
  const filtered = pubDefinitions
    .map((pub) => toAdminPubListItem(pub, locale))
    .filter((pub) => matchesAdminCondition(pub, condition));
  const offset = (condition.page - 1) * ADMIN_PUB_PAGE_SIZE;
  return {
    pubs: filtered.slice(offset, offset + ADMIN_PUB_PAGE_SIZE),
    total: filtered.length,
    page: condition.page,
    pageSize: ADMIN_PUB_PAGE_SIZE,
  };
}

/**
 * E2Eで管理店舗編集画面へ返す固定詳細を取得します。
 * @param {string} id - 取得対象の店舗UUID。
 * @returns {AdminPub | null} 固定店舗詳細、または対象なし。
 */
export function getE2EAdminPub(id: string): AdminPub | null {
  const pub = pubDefinitions.find((candidate) => candidate.id === id);
  if (!pub) return null;
  return {
    id: pub.id,
    isPublished: pub.isPublished,
    prefectureCode: pub.prefectureCode,
    municipalityCode: pub.municipalityCode,
    latitude: pub.latitude,
    longitude: pub.longitude,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    status: pub.status,
    translations: {
      ja: { name: pub.name, nameReading: pub.kana, address: pub.addressJa },
      en: { name: pub.name, nameReading: null, address: pub.addressEn },
    },
    tagIds: [...pub.tagIds],
    updatedAt: UPDATED_AT,
  };
}

/**
 * E2E用の都道府県選択肢を返します。
 * @param {Locale} locale - fixtureの表示ロケール。
 * @returns {PrefectureOption[]} 固定都道府県一覧。
 */
export function getE2EPrefectures(locale: Locale): PrefectureOption[] {
  return prefectureDefinitions.map((value) => ({ code: value.code, name: value[locale] }));
}

/**
 * E2E用の市区町村選択肢を返します。
 * @param {number} prefectureCode - 絞り込む都道府県コード。
 * @param {Locale} locale - fixtureの表示ロケール。
 * @returns {MunicipalityOption[]} 固定市区町村一覧。
 */
export function getE2EMunicipalities(prefectureCode: number, locale: Locale): MunicipalityOption[] {
  return municipalityDefinitions
    .filter((value) => value.prefectureCode === prefectureCode)
    .map((value) => ({ code: value.code, prefectureCode: value.prefectureCode, name: value[locale] }));
}

/**
 * E2E用のタグ選択肢を返します。
 * @param {Locale} locale - fixtureの表示ロケール。
 * @returns {TagOption[]} 固定タグ一覧。
 */
export function getE2ETags(locale: Locale): TagOption[] {
  return tagDefinitions.map((value) => ({ id: value.id, key: value.key, name: value[locale] }));
}

/**
 * E2E用の営業ステータス選択肢を返します。
 * @param {Locale} locale - fixtureの表示ロケール。
 * @returns {PubStatusOption[]} 固定営業ステータス一覧。
 */
export function getE2EPubStatuses(locale: Locale): PubStatusOption[] {
  return statusDefinitions.map((value) => ({ code: value.code, key: value.key, name: value[locale] }));
}

/**
 * E2E用のタグ管理一覧を返します。
 * @returns {AdminTag[]} 固定タグ管理一覧。
 */
export function getE2EAdminTags(): AdminTag[] {
  return tagDefinitions.map((value) => ({
    id: value.id,
    key: value.key,
    translations: { ja: value.ja, en: value.en },
    pubCount: 1,
  }));
}

/**
 * E2E用の営業ステータス管理一覧を返します。
 * @returns {AdminPubStatus[]} 固定営業ステータス管理一覧。
 */
export function getE2EAdminPubStatuses(): AdminPubStatus[] {
  return statusDefinitions.map((value) => ({ code: value.code, key: value.key, nameJa: value.ja, nameEn: value.en }));
}

type PubDefinition = (typeof pubDefinitions)[number];

function toPublishedPub(pub: PubDefinition, locale: Locale): Pub {
  const prefecture = prefectureDefinitions.find((value) => value.code === pub.prefectureCode)!;
  const municipality = municipalityDefinitions.find((value) => value.code === pub.municipalityCode)!;
  const status = statusDefinitions.find((value) => value.key === pub.status)!;
  const tags = tagDefinitions.filter((value) => hasTagId(pub, value.id));
  return {
    id: pub.id,
    name: pub.name,
    kana: pub.kana,
    prefecture: prefecture[locale],
    city: municipality[locale],
    municipalityCode: pub.municipalityCode,
    address: locale === "ja" ? pub.addressJa : pub.addressEn,
    latitude: pub.latitude,
    longitude: pub.longitude,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: tags.map((value) => value.key),
    tagDisplayNames: Object.fromEntries(tags.map((value) => [value.key, value[locale]])),
    status: pub.status,
    statusDisplayName: status[locale],
  };
}

function toAdminPubListItem(pub: PubDefinition, locale: Locale): AdminPubListItem {
  const published = toPublishedPub(pub, locale);
  const tagItems = tagDefinitions
    .filter((value) => hasTagId(pub, value.id))
    .map((value) => ({ id: value.id, key: value.key, name: value[locale] }));
  return {
    ...published,
    kana: published.kana ?? null,
    prefecture: published.prefecture,
    city: published.city ?? null,
    municipalityCode: published.municipalityCode ?? null,
    address: published.address,
    latitude: published.latitude,
    longitude: published.longitude,
    websiteUrl: published.websiteUrl ?? null,
    googleMapsUrl: published.googleMapsUrl ?? null,
    instagramUrl: published.instagramUrl ?? null,
    tagDisplayNames: published.tagDisplayNames ?? {},
    status: published.status,
    prefectureCode: pub.prefectureCode,
    statusCode: pub.statusCode,
    statusDisplayName: published.statusDisplayName ?? null,
    tagItems,
    isPublished: pub.isPublished,
    updatedAt: UPDATED_AT,
  };
}

function hasTagId(pub: PubDefinition, tagId: string): boolean {
  return (pub.tagIds as readonly string[]).includes(tagId);
}

function matchesAdminCondition(pub: AdminPubListItem, condition: AdminPubSearchCondition): boolean {
  return (
    (!condition.name || pub.name.toLocaleLowerCase("ja").includes(condition.name.toLocaleLowerCase("ja"))) &&
    (!condition.prefectureCode || pub.prefectureCode === condition.prefectureCode) &&
    (!condition.municipalityCode || pub.municipalityCode === condition.municipalityCode) &&
    (!condition.statusKey || pub.status === condition.statusKey) &&
    (!condition.tagId || pub.tagItems.some((tag) => tag.id === condition.tagId)) &&
    (condition.isPublished === undefined || pub.isPublished === condition.isPublished)
  );
}
