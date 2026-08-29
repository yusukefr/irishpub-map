import { AdminPubSearchValidationError, parseAdminPubSearchParams } from "@irishpub-map/shared/admin-pub";
import { redirect } from "next/navigation";
import { getRequestLocale } from "../../../lib/i18n/server";
import { AdminPubManager } from "../../../components/admin-pub-manager";
import { requireAdminSession } from "../../../lib/admin-server";
import { getAdminPubPage, isDatabaseConfigured } from "../../../lib/pub-repository";
import { getMunicipalitiesByPrefecture, getPrefectures, getPubStatuses, getTags } from "../../../lib/master-repository";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 管理者セッションを検証してから、既存の店舗管理機能を表示します。
 * @param {{ searchParams?: SearchParams }} root0 - URLに保持した管理店舗検索条件。
 * @param {SearchParams} [root0.searchParams] - Next.jsが渡す非同期Query Parameter。
 * @returns {Promise<JSX.Element>} 店舗管理画面。
 */
export default async function AdminPage({ searchParams = Promise.resolve({}) }: { searchParams?: SearchParams } = {}) {
  await requireAdminSession();
  const locale = await getRequestLocale();
  const query = toUrlSearchParams(await searchParams);
  let condition;
  try {
    condition = parseAdminPubSearchParams(query);
  } catch (error) {
    if (!(error instanceof AdminPubSearchValidationError)) throw error;
    condition = { page: 1 } as const;
  }
  const [initialPage, prefectures, statuses, tags, municipalities] = await Promise.all([
    getAdminPubPage(condition, locale),
    getPrefectures(locale),
    getPubStatuses(locale),
    getTags(locale),
    condition.prefectureCode ? getMunicipalitiesByPrefecture(condition.prefectureCode, locale) : Promise.resolve([]),
  ]);
  if (initialPage.total > 0 && initialPage.pubs.length === 0 && condition.page > 1) {
    const lastPage = Math.ceil(initialPage.total / initialPage.pageSize);
    if (lastPage < condition.page) {
      if (lastPage === 1) query.delete("page");
      else query.set("page", String(lastPage));
      const normalizedQuery = query.toString();
      redirect(normalizedQuery ? `/admin/pubs?${normalizedQuery}` : "/admin/pubs");
    }
  }
  return (
    <AdminPubManager
      key={`${query.toString()}:${initialPage.pubs.map((pub) => `${pub.id}:${pub.updatedAt}:${pub.isPublished}`).join(",")}`}
      initialPage={initialPage}
      condition={condition}
      prefectures={prefectures}
      municipalities={municipalities}
      statuses={statuses}
      tags={tags}
      databaseConfigured={isDatabaseConfigured()}
      locale={locale}
    />
  );
}

function toUrlSearchParams(values: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}
