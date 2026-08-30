import { notFound } from "next/navigation";
import { isPubId } from "@irishpub-map/shared/pub";
import { AdminPubEditor } from "../../../../../components/admin-pub-editor";
import { requireAdminSession } from "../../../../../lib/admin-server";
import { readAdminPub, AdminPubServiceError } from "../../../../../lib/admin-pub-service";
import { getRequestLocale } from "../../../../../lib/i18n/server";
import {
  getMunicipalitiesByPrefecture,
  getPrefectures,
  getPubStatuses,
  getTags,
} from "../../../../../lib/master-repository";
import { isDatabaseConfigured } from "../../../../../lib/pub-repository";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 管理者向けの店舗編集フォームを表示します。対象店舗が存在しない場合は404を返します。
 * @param {{ params: Promise<{ id: string }> }} props - URLに含まれる店舗IDと一覧への戻り先。
 * @returns {Promise<JSX.Element>} 店舗編集画面。
 */
export default async function EditAdminPubPage({
  params,
  searchParams = Promise.resolve({}),
}: {
  params: Promise<{ id: string }>;
  searchParams?: SearchParams;
}) {
  await requireAdminSession();
  const { id } = await params;
  if (!isPubId(id)) notFound();
  const locale = await getRequestLocale();
  const returnTo = getSafeReturnTo((await searchParams).returnTo);
  const databaseConfigured = isDatabaseConfigured();
  const pub = databaseConfigured ? await getPubOrNotFound(id) : null;
  const [prefectures, statuses, tags, municipalities] = await Promise.all([
    getPrefectures(locale),
    getPubStatuses(locale),
    getTags(locale),
    pub?.prefectureCode ? getMunicipalitiesByPrefecture(pub.prefectureCode, locale) : Promise.resolve([]),
  ]);
  return (
    <AdminPubEditor
      initialPub={pub}
      prefectures={prefectures}
      municipalities={municipalities}
      statuses={statuses}
      tags={tags}
      databaseConfigured={databaseConfigured}
      locale={locale}
      returnTo={returnTo}
    />
  );
}

function getSafeReturnTo(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "/admin/pubs" || candidate?.startsWith("/admin/pubs?") ? candidate : "/admin/pubs";
}

async function getPubOrNotFound(id: string) {
  try {
    return await readAdminPub(id);
  } catch (error) {
    if (error instanceof AdminPubServiceError && error.code === "not_found") notFound();
    throw error;
  }
}
