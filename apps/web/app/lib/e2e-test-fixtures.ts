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
import type { AdminContent, AdminContentListItem } from "@irishpub-map/shared/admin-content";
import type { Locale } from "@irishpub-map/shared/locale";
import type { Pub } from "@irishpub-map/shared/pub";
import type { ContentKind, PublishedContent, PublishedContentSummary } from "./content/types";
import type { AdminQuizListItem, AdminQuizQuestion, PublicQuizQuestion, QuizAnswerResult } from "./quiz/types";

export const E2E_TEST_DATA = {
  content: {
    draft: { id: "30000000-0000-4000-8000-000000000201", title: "E2E 下書きガイド" },
    published: { id: "30000000-0000-4000-8000-000000000202", title: "E2E 公開ガイド" },
  },
  pubs: {
    nagoya: { id: "30000000-0000-4000-8000-000000000001", name: "E2E Irish Pub Nagoya" },
    tokyo: { id: "30000000-0000-4000-8000-000000000002", name: "E2E Irish Pub Tokyo" },
  },
  tags: {
    guinness: { id: "30000000-0000-4000-8000-000000000101", key: "guinness" },
    whiskey: { id: "30000000-0000-4000-8000-000000000102", key: "whiskey" },
  },
  media: {
    landscape: {
      id: "30000000-0000-4000-8000-000000000301",
      url: "/media-fixtures/landscape.jpg",
      mimeType: "image/jpeg",
      width: 1200,
      height: 800,
      fileSize: 184_320,
      createdAt: "2026-09-20T10:00:00.000Z",
    },
    portrait: {
      id: "30000000-0000-4000-8000-000000000302",
      url: "/media-fixtures/portrait.webp",
      mimeType: "image/webp",
      width: 800,
      height: 1200,
      fileSize: 96_256,
      createdAt: "2026-09-21T10:00:00.000Z",
    },
  },
} as const;

const UPDATED_AT = "2026-01-15T12:00:00.000Z";
const publishedGuideDefinitions: Record<Locale, PublishedContent[]> = {
  ja: [
    {
      kind: "guide",
      slug: "split-the-g",
      category: "pub-culture",
      publishedAt: "2026-09-05T00:00:00.000Z",
      title: "Split the Gを楽しむ",
      summary: "Guinnessのグラスを使ったPubの遊び「Split the G」を、安全に楽しむためのガイドです。",
      heroImage: {
        url: E2E_TEST_DATA.media.landscape.url,
        width: 1200,
        height: 800,
        alt: "パブのテーブルに置かれたグラス",
        caption: "パブで過ごす時間",
      },
      bodyMarkdown:
        "## Split the Gとは\n\n地域や一緒に楽しむ人によって判定方法は異なります。\n\nSplit the Gは、成功や飲む速さ・量を競うものではありません。\n\n[Irish Pubを探す →](/)",
    },
    {
      kind: "guide",
      slug: "sample",
      category: "culture",
      publishedAt: "2026-09-02T00:00:00.000Z",
      title: "サンプルガイド",
      summary: "Explore Irelandセクション用のサンプルコンテンツです。",
      heroImage: null,
      bodyMarkdown: "コンテンツは後日追加予定です。",
    },
  ],
  en: [
    {
      kind: "guide",
      slug: "split-the-g",
      category: "pub-culture",
      publishedAt: "2026-09-05T00:00:00.000Z",
      title: "How to Enjoy Split the G",
      summary: "A guide to enjoying the pub game Split the G with a Guinness glass, safely and at your own pace.",
      heroImage: {
        url: E2E_TEST_DATA.media.landscape.url,
        width: 1200,
        height: 800,
        alt: "A glass on a pub table",
        caption: "Time at the pub",
      },
      bodyMarkdown:
        "## What is Split the G?\n\nHow the result is judged varies between places and groups.\n\nSplit the G is not about drinking quickly or drinking more.\n\n[Find an Irish pub →](/)",
    },
    {
      kind: "guide",
      slug: "sample",
      category: "culture",
      publishedAt: "2026-09-02T00:00:00.000Z",
      title: "Sample Guide",
      summary: "Sample content for the Explore Ireland section.",
      heroImage: null,
      bodyMarkdown: "Content will be added later.",
    },
  ],
};
const contentDefinitions: AdminContent[] = [
  {
    id: E2E_TEST_DATA.content.draft.id,
    kind: "guide",
    slug: "e2e-draft-guide",
    category: "pub-culture",
    status: "draft",
    publishedAt: null,
    heroImageAssetId: null,
    heroImage: null,
    translations: {
      ja: {
        title: E2E_TEST_DATA.content.draft.title,
        summary: "E2Eで管理画面を確認するための下書きです。",
        bodyMarkdown: "## 下書き本文\n\n[安全なリンク](/discover)",
        heroImageAlt: "",
        heroImageCaption: "",
      },
      en: {
        title: "E2E Draft Guide",
        summary: "A draft used to verify the content admin UI.",
        bodyMarkdown: "## Draft body\n\n[Safe link](/discover)",
        heroImageAlt: "",
        heroImageCaption: "",
      },
    },
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: E2E_TEST_DATA.content.published.id,
    kind: "guide",
    slug: "e2e-published-guide",
    category: "culture",
    status: "published",
    publishedAt: UPDATED_AT,
    heroImageAssetId: E2E_TEST_DATA.media.landscape.id,
    heroImage: E2E_TEST_DATA.media.landscape,
    translations: {
      ja: {
        title: E2E_TEST_DATA.content.published.title,
        summary: "E2Eで管理画面を確認するための公開記事です。",
        bodyMarkdown: "## 公開本文",
        heroImageAlt: "パブのテーブルに置かれたグラス",
        heroImageCaption: "パブで過ごす時間",
      },
      en: {
        title: "E2E Published Guide",
        summary: "Published content used to verify the content admin UI.",
        bodyMarkdown: "## Published body",
        heroImageAlt: "A glass on a pub table",
        heroImageCaption: "Time at the pub",
      },
    },
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
  },
];
const quizDefinitions: AdminQuizQuestion[] = [
  {
    id: "e2e-draft-question",
    category: null,
    specialDate: null,
    correctChoiceId: null,
    sourceUrl: null,
    relatedContentId: null,
    imageAssetId: null,
    image: null,
    isPublished: false,
    translations: {
      ja: { question: "E2E 下書きQuiz", explanation: "", sourceLabel: "", imageAlt: "", imageCaption: "" },
      en: { question: "E2E Draft Quiz", explanation: "", sourceLabel: "", imageAlt: "", imageCaption: "" },
    },
    choices: [],
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: "e2e-published-question",
    category: "history",
    specialDate: { month: 3, day: 17 },
    correctChoiceId: "choice-1",
    sourceUrl: "https://example.com/e2e-quiz",
    relatedContentId: E2E_TEST_DATA.content.published.id,
    imageAssetId: E2E_TEST_DATA.media.landscape.id,
    image: E2E_TEST_DATA.media.landscape,
    isPublished: true,
    translations: {
      ja: {
        question: "E2E 公開Quiz",
        explanation: "E2E用の解説です。",
        sourceLabel: "E2E Source",
        imageAlt: "緑色の問題用画像",
        imageCaption: "問題用の画像",
      },
      en: {
        question: "E2E Published Quiz",
        explanation: "An explanation for E2E.",
        sourceLabel: "E2E Source",
        imageAlt: "A green quiz image",
        imageCaption: "Question image",
      },
    },
    choices: [1, 2, 3, 4].map((number, index) => ({
      id: "choice-" + number,
      sortOrder: index,
      translations: { ja: "選択肢" + number, en: "Choice " + number },
    })),
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
  },
];

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
    status: "open" as const,
    statusCode: 1,
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

/**
 * E2EでContent管理一覧へ返す固定データを取得します。
 * @returns {AdminContentListItem[]} DraftとPublishedを含む固定一覧。
 */
export function getE2EAdminContentList(): AdminContentListItem[] {
  return contentDefinitions.map(({ translations, ...content }) => ({
    ...content,
    titleJa: translations.ja.title,
    titleEn: translations.en.title,
  }));
}

/**
 * E2EでContent編集画面へ返す固定詳細を取得します。
 * @param {string} id - 取得対象のContent UUID。
 * @returns {AdminContent | null} 固定Content詳細、または対象なし。
 */
export function getE2EAdminContent(id: string): AdminContent | null {
  return contentDefinitions.find((content) => content.id === id) ?? null;
}

/**
 * E2EでQuiz管理一覧へ返す固定データを取得します。
 * @returns {AdminQuizListItem[]} 固定Quiz一覧。
 */
export function getE2EAdminQuizList(): AdminQuizListItem[] {
  return quizDefinitions.map((question) => ({
    id: question.id,
    category: question.category,
    specialDate: question.specialDate,
    correctChoiceId: question.correctChoiceId,
    sourceUrl: question.sourceUrl,
    relatedContentId: question.relatedContentId,
    imageAssetId: question.imageAssetId,
    isPublished: question.isPublished,
    questionJa: question.translations.ja.question,
    questionEn: question.translations.en.question,
    choiceCount: question.choices.length,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  }));
}

/**
 * E2EでQuiz編集画面へ返す固定詳細を取得します。
 * @param id
 * @returns {AdminQuizQuestion \| null} 固定Quiz詳細、または対象なし。
 */
export function getE2EAdminQuiz(id: string): AdminQuizQuestion | null {
  return quizDefinitions.find((question) => question.id === id) ?? null;
}

/**
 * E2EでPublic Quizへ返すPublished QuestionをLocale別に生成します。
 * @param {Locale} locale - fixtureの表示ロケール。
 * @returns {readonly PublicQuizQuestion[]} 回答前に公開できる固定Question。
 */
export function getE2EPublishedQuizQuestions(locale: Locale): readonly PublicQuizQuestion[] {
  return quizDefinitions
    .filter((question) => question.isPublished)
    .map((question) => ({
      id: question.id,
      category: question.category!,
      question: question.translations[locale].question || question.translations.ja.question,
      image: question.image
        ? {
            id: question.image.id,
            url: question.image.url,
            width: question.image.width,
            height: question.image.height,
            alt: question.translations[locale].imageAlt,
            caption: question.translations[locale].imageCaption || null,
          }
        : null,
      choices: question.choices.map((choice) => ({
        id: choice.id,
        label: choice.translations[locale] || choice.translations.ja,
      })),
      ...(question.specialDate ? { specialDate: question.specialDate } : {}),
    }));
}

/**
 * E2EでPublished Questionをサーバー側fixtureとして採点します。
 * @param {string} questionId - 表示中のQuestion ID。
 * @param {string} choiceId - 利用者が選択したChoice ID。
 * @param {Locale} locale - 結果の表示ロケール。
 * @returns {QuizAnswerResult} 回答後に公開できる固定採点結果。
 */
export function gradeE2EPublishedQuizAnswer(questionId: string, choiceId: string, locale: Locale): QuizAnswerResult {
  const question = quizDefinitions.find((candidate) => candidate.id === questionId && candidate.isPublished);
  if (!question) throw new Error("Quiz question was not found");
  if (!question.choices.some((choice) => choice.id === choiceId)) throw new Error("Quiz choice was not found");
  const correctChoice = question.choices.find((choice) => choice.id === question.correctChoiceId);
  if (!correctChoice || !question.sourceUrl) throw new Error("Invalid E2E quiz fixture.");

  const result: QuizAnswerResult = {
    status: choiceId === correctChoice.id ? "correct" : "incorrect",
    correctChoiceId: correctChoice.id,
    correctChoiceLabel: correctChoice.translations[locale] || correctChoice.translations.ja,
    explanation: question.translations[locale].explanation || question.translations.ja.explanation,
    source: {
      label: question.translations[locale].sourceLabel || question.translations.ja.sourceLabel,
      url: question.sourceUrl,
    },
  };
  if (question.relatedContentId) {
    const relatedGuide = contentDefinitions.find(
      (content) =>
        content.id === question.relatedContentId && content.kind === "guide" && content.status === "published",
    );
    if (relatedGuide) {
      return {
        ...result,
        relatedGuide: {
          slug: relatedGuide.slug ?? "",
          label: relatedGuide.translations[locale].title ?? relatedGuide.translations.ja.title ?? "",
        },
      };
    }
  }
  return result;
}

/**
 * E2Eで公開Routeへ返すPublished Contentを取得します。
 * @param {ContentKind} kind - Content種類。
 * @param {string} slug - Content slug。
 * @param {Locale} locale - fixtureの表示ロケール。
 * @returns {PublishedContent | null} 公開fixture、または対象なし。
 */
export function getE2EPublishedContentBySlug(kind: ContentKind, slug: string, locale: Locale): PublishedContent | null {
  return publishedGuideDefinitions[locale].find((content) => content.kind === kind && content.slug === slug) ?? null;
}

/**
 * E2Eで公開一覧へ返すPublished Content metadataを取得します。
 * @param {ContentKind} kind - Content種類。
 * @param {Locale} locale - fixtureの表示ロケール。
 * @returns {PublishedContentSummary[]} 公開fixtureの一覧。
 */
export function getE2EPublishedContentList(kind: ContentKind, locale: Locale): PublishedContentSummary[] {
  return publishedGuideDefinitions[locale]
    .filter((content) => content.kind === kind)
    .map((content) => ({
      kind: content.kind,
      slug: content.slug,
      category: content.category,
      publishedAt: content.publishedAt,
      title: content.title,
      summary: content.summary,
      heroImage: content.heroImage
        ? {
            url: content.heroImage.url,
            width: content.heroImage.width,
            height: content.heroImage.height,
            alt: content.heroImage.alt,
          }
        : null,
    }));
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
