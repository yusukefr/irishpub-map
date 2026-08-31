import { contentRegistry } from "./registry";
import type {
  ContentArticleMetadata,
  ContentKind,
  ContentLocaleLoaders,
  ContentModule,
  ContentRegistry,
} from "./types";
import type { Locale } from "../i18n";

/** 読み込み済み記事の表示に必要なMDX Componentとメタデータです。 */
export type LoadedContent = {
  Component: ContentModule["default"];
  metadata: ContentArticleMetadata;
};

function resolveContentLoaders(kind: ContentKind, slug: string, registry: ContentRegistry) {
  return registry[kind][slug];
}

function validateContentModule(module: ContentModule, kind: ContentKind, slug: string) {
  if (module.metadata.slug !== slug || module.metadata.kind !== kind) {
    throw new Error(`Content metadata does not match the registry entry: ${kind}/${slug}.`);
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
  return resolveContentLoaders(kind, slug, registry);
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
  const loaders = getContentLoaders(kind, slug, registry);
  if (!loaders) return null;

  const contentModule = await loaders[locale]();

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
