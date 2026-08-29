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

/**
 * 管理者向けの店舗編集フォームを表示します。対象店舗が存在しない場合は404を返します。
 * @param {{ params: Promise<{ id: string }> }} props - URLに含まれる店舗ID。
 * @returns {Promise<JSX.Element>} 店舗編集画面。
 */
export default async function EditAdminPubPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  if (!isPubId(id)) notFound();
  const locale = await getRequestLocale();
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
    />
  );
}

async function getPubOrNotFound(id: string) {
  try {
    return await readAdminPub(id);
  } catch (error) {
    if (error instanceof AdminPubServiceError && error.code === "not_found") notFound();
    throw error;
  }
}
