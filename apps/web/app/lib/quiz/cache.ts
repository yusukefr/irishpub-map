import { revalidateTag, unstable_cache } from "next/cache";
import type { Locale } from "../i18n";
import type { PublicQuizQuestion } from "./types";

/** Public QuizのPublished Question一覧に付与するCache Tagです。 */
export const PUBLIC_QUIZ_CACHE_TAG = "public-quiz";

/**
 * Locale別のPublished Question一覧をCacheします。
 * @param {Locale} locale - 翻訳取得に使用するLocale。
 * @param {() => Promise<readonly PublicQuizQuestion[]>} query - Cache miss時に実行するDB取得。
 * @returns {Promise<readonly PublicQuizQuestion[]>} Cache済みの公開Question一覧。
 */
export function getCachedPublishedQuizQuestions(
  locale: Locale,
  query: () => Promise<readonly PublicQuizQuestion[]>,
): Promise<readonly PublicQuizQuestion[]> {
  return unstable_cache(query, ["public-quiz-questions", locale], {
    tags: [PUBLIC_QUIZ_CACHE_TAG],
    revalidate: 300,
  })();
}

/** Public QuizのPublished Question一覧を即時失効させます。 */
export function invalidatePublicQuizCache(): void {
  revalidateTag(PUBLIC_QUIZ_CACHE_TAG, { expire: 0 });
}
