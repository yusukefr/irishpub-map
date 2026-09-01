import { contentRegistry } from "./registry";
import type {
  ContentArticleMetadata,
  ContentCategory,
  ContentKind,
  ContentLocaleLoaders,
  ContentModule,
  ContentRegistry,
  ContentRegistryEntry,
} from "./types";
import type { Locale } from "../i18n";

const CONTENT_CATEGORIES = new Set<ContentCategory>(["history", "culture", "pub-culture", "food-drink"]);

/** 読み込み済み記事の表示に必要なMDX Componentとメタデータです。 */
export type LoadedContent = {
  Component: ContentModule["default"];
  metadata: ContentArticleMetadata;
};

function resolveContentEntry(
  kind: ContentKind,
  slug: string,
  registry: ContentRegistry,
): ContentRegistryEntry | undefined {
  const entries = registry[kind];

  return Object.hasOwn(entries, slug) ? entries[slug] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isContentMetadata(value: unknown, kind: ContentKind, slug: string): value is ContentArticleMetadata {
  if (!isRecord(value)) return false;

  return (
    value.slug === slug &&
    value.kind === kind &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.category === "string" &&
    CONTENT_CATEGORIES.has(value.category as ContentCategory) &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.publishedAt === "string"
  );
}

function validateContentModule(
  contentModule: unknown,
  kind: ContentKind,
  slug: string,
): asserts contentModule is ContentModule {
  if (
    !isRecord(contentModule) ||
    typeof contentModule.default !== "function" ||
    !isContentMetadata(contentModule.metadata, kind, slug)
  ) {
    throw new Error("Invalid content module metadata for " + kind + "/" + slug + ".");
  }
}

/**
 * kindとslugに対応する記事の日本語・英語Loaderを取得します。
 * @param {ContentKind} kind - 記事の種類。
 * @param {string} slug - Registryで許可されたslug。
 * @param {ContentRegistry} registry - 解決対象のAllow List。
 * @returns {ContentLocaleLoaders | undefined} 登録済みLoader、または未登録時のundefined。
 */
export function getContentLoaders(
  kind: ContentKind,
  slug: string,
  registry: ContentRegistry = contentRegistry,
): ContentLocaleLoaders | undefined {
  return resolveContentEntry(kind, slug, registry)?.loaders;
}

/**
 * kindに登録された記事slugを返します。
 * @param {ContentKind} kind - 記事の種類。
 * @param {ContentRegistry} registry - 解決対象のAllow List。
 * @returns {readonly string[]} 登録順のslug一覧。
 */
export function getContentSlugs(kind: ContentKind, registry: ContentRegistry = contentRegistry): readonly string[] {
  return Object.keys(registry[kind]);
}

/**
 * Registryで許可された記事だけを指定localeで読み込みます。
 * @param {ContentKind} kind - 記事の種類。
 * @param {string} slug - 読み込む記事slug。
 * @param {Locale} locale - 本文の表示言語。
 * @param {ContentRegistry} registry - 解決対象のAllow List。
 * @returns {Promise<LoadedContent | null>} 未登録slugの場合はnull。
 */
export async function loadContent(
  kind: ContentKind,
  slug: string,
  locale: Locale,
  registry: ContentRegistry = contentRegistry,
): Promise<LoadedContent | null> {
  const entry = resolveContentEntry(kind, slug, registry);
  if (!entry) return null;
  if (entry.slug !== slug || entry.kind !== kind) {
    throw new Error("Content registry entry does not match the requested route: " + kind + "/" + slug + ".");
  }

  const contentModule = await entry.loaders[locale]();

  validateContentModule(contentModule, kind, slug);

  return { Component: contentModule.default, metadata: contentModule.metadata };
}

/**
 * kindに登録された記事の指定localeメタデータを一覧取得します。
 * @param {ContentKind} kind - 記事の種類。
 * @param {Locale} locale - 本文の表示言語。
 * @param {ContentRegistry} registry - 解決対象のAllow List。
 * @returns {Promise<readonly ContentArticleMetadata[]>} Registry順のメタデータ一覧。
 */
export async function listContent(
  kind: ContentKind,
  locale: Locale,
  registry: ContentRegistry = contentRegistry,
): Promise<readonly ContentArticleMetadata[]> {
  const articles = await Promise.all(
    getContentSlugs(kind, registry).map((slug) => loadContent(kind, slug, locale, registry)),
  );
  return articles.flatMap((article) => (article ? [article.metadata] : []));
}
