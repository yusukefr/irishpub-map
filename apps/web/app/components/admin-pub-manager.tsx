"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminPub,
  AdminPubListItem,
  AdminPubPage,
  AdminPubSearchCondition,
  AdminPubWriteInput,
} from "@irishpub-map/shared/admin-pub";
import type {
  MunicipalityOption,
  PrefectureOption,
  PubStatusOption,
  TagOption,
} from "@irishpub-map/shared/admin-master";
import { getAdminApiErrorMessage } from "../lib/admin-api-client";
import { formatMessage, getTranslation, type Locale } from "../lib/i18n";

type Props = {
  initialPage: AdminPubPage;
  condition: AdminPubSearchCondition;
  prefectures: PrefectureOption[];
  municipalities: MunicipalityOption[];
  statuses: PubStatusOption[];
  tags: TagOption[];
  databaseConfigured: boolean;
  locale: Locale;
};
type ApiResponse = { pub?: AdminPub; errorCode?: unknown };
type MunicipalityResponse = { municipalities?: unknown };
type PublicationResponse = {
  publication?: { id: string; isPublished: boolean; unchanged: boolean };
  errorCode?: unknown;
  missingFields?: unknown;
};
const emptyPub = {
  name: "",
  nameReading: null,
  prefectureCode: "",
  municipalityCode: "",
  address: "",
  latitude: "",
  longitude: "",
  websiteUrl: "",
  googleMapsUrl: "",
  instagramUrl: "",
  tagIds: [] as string[],
  status: "",
};

/** フォーム値をAPI入力形式へ変換し、未入力の任意項目を正規化します。 */
function toBody(form: FormData, editing: AdminPub | null): AdminPubWriteInput {
  return {
    prefectureCode: nullableNumber(form.get("prefectureCode")),
    municipalityCode: nullableString(form.get("municipalityCode")),
    latitude: nullableNumber(form.get("latitude")),
    longitude: nullableNumber(form.get("longitude")),
    websiteUrl: nullableString(form.get("websiteUrl")),
    googleMapsUrl: nullableString(form.get("googleMapsUrl")),
    instagramUrl: nullableString(form.get("instagramUrl")),
    status: nullableString(form.get("status")) as AdminPubWriteInput["status"],
    translations: {
      ja: {
        name: String(form.get("name") ?? "").trim(),
        nameReading: editing?.translations.ja.nameReading ?? null,
        address: nullableString(form.get("address")),
      },
      // 最小フォームで編集しない既存の英語翻訳は、全体更新時にも失わないよう維持します。
      en: editing?.translations.en ?? null,
    },
    tagIds: form.getAll("tagIds").map(String),
  };
}

function nullableString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function nullableNumber(value: FormDataEntryValue | null) {
  const normalized = nullableString(value);
  return normalized === null ? null : Number(normalized);
}

/**
 * 管理者向けの店舗追加・編集・削除とローカル一覧状態を管理します。
 * @param {Props} root0 - 一覧、検索条件、参照マスタ、DB設定、表示言語を含む初期状態。
 * @param {AdminPubPage} root0.initialPage - 初期表示するページング済み店舗一覧。
 * @param {AdminPubSearchCondition} root0.condition - URLから検証した検索条件。
 * @param {PrefectureOption[]} root0.prefectures - 都道府県の絞り込み候補。
 * @param {MunicipalityOption[]} root0.municipalities - 選択都道府県の市区町村候補。
 * @param {PubStatusOption[]} root0.statuses - 営業ステータスの絞り込み候補。
 * @param {TagOption[]} root0.tags - タグの絞り込み候補。
 * @param {boolean} root0.databaseConfigured - DB永続化が利用可能かどうか。
 * @param {Locale} root0.locale - 管理画面の表示言語。
 * @returns {JSX.Element} 店舗管理画面。
 */
export function AdminPubManager({
  initialPage,
  condition,
  prefectures,
  municipalities: initialMunicipalities,
  statuses: statusOptions,
  tags: tagOptions,
  databaseConfigured,
  locale,
}: Props) {
  const t = getTranslation(locale);
  const router = useRouter();
  const [pubs, setPubs] = useState(initialPage.pubs);
  const [editing, setEditing] = useState<AdminPub | null>(null);
  const [message, setMessage] = useState("");
  const [selectedPrefecture, setSelectedPrefecture] = useState(String(condition.prefectureCode ?? ""));
  const [selectedMunicipality, setSelectedMunicipality] = useState(condition.municipalityCode ?? "");
  const [municipalities, setMunicipalities] = useState(initialMunicipalities);
  const [formPrefecture, setFormPrefecture] = useState("");
  const [formMunicipality, setFormMunicipality] = useState("");
  const [formMunicipalities, setFormMunicipalities] = useState<MunicipalityOption[]>([]);
  const [publicationPending, setPublicationPending] = useState<string | null>(null);
  const municipalityRequest = useRef<AbortController | null>(null);
  const formMunicipalityRequest = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      municipalityRequest.current?.abort();
      formMunicipalityRequest.current?.abort();
    },
    [],
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    try {
      const response = await fetch(editing ? `/api/admin/pubs/${editing.id}` : "/api/admin/pubs", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(new FormData(form), editing)),
      });
      const body = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !body.pub) return setMessage(getAdminApiErrorMessage(locale, body));
      resetEditor();
      form.reset();
      setMessage(t.admin.saved);
      router.refresh();
    } catch {
      setMessage(getAdminApiErrorMessage(locale, null));
    }
  }

  async function remove(pub: Pick<AdminPubListItem, "id" | "name">) {
    if (!window.confirm(formatMessage(t.admin.confirmDelete, { name: pub.name }))) return;
    try {
      const response = await fetch(`/api/admin/pubs/${pub.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok) return setMessage(getAdminApiErrorMessage(locale, body));
      setPubs((current) => current.filter((item) => item.id !== pub.id));
      setMessage(t.admin.deleted);
      router.refresh();
    } catch {
      setMessage(getAdminApiErrorMessage(locale, null));
    }
  }

  async function changePrefecture(value: string) {
    municipalityRequest.current?.abort();
    municipalityRequest.current = null;
    setSelectedPrefecture(value);
    setSelectedMunicipality("");
    setMunicipalities([]);
    if (!value) return;
    const controller = new AbortController();
    municipalityRequest.current = controller;
    try {
      const response = await fetch(`/api/admin/master/municipalities?prefectureCode=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as MunicipalityResponse;
      if (controller.signal.aborted) return;
      if (!response.ok || !Array.isArray(body.municipalities)) {
        setMessage(getAdminApiErrorMessage(locale, body));
        return;
      }
      setMunicipalities(body.municipalities as MunicipalityOption[]);
    } catch {
      if (controller.signal.aborted) return;
      setMessage(getAdminApiErrorMessage(locale, null));
    } finally {
      if (municipalityRequest.current === controller) municipalityRequest.current = null;
    }
  }

  async function loadFormMunicipalities(value: string) {
    formMunicipalityRequest.current?.abort();
    formMunicipalityRequest.current = null;
    if (!value) return [];
    const controller = new AbortController();
    formMunicipalityRequest.current = controller;
    try {
      const response = await fetch(`/api/admin/master/municipalities?prefectureCode=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as MunicipalityResponse;
      if (controller.signal.aborted) return null;
      if (!response.ok || !Array.isArray(body.municipalities)) {
        setMessage(getAdminApiErrorMessage(locale, body));
        return null;
      }
      return body.municipalities as MunicipalityOption[];
    } catch {
      if (controller.signal.aborted) return null;
      setMessage(getAdminApiErrorMessage(locale, null));
      return null;
    } finally {
      if (formMunicipalityRequest.current === controller) formMunicipalityRequest.current = null;
    }
  }

  async function changeFormPrefecture(value: string) {
    setFormPrefecture(value);
    setFormMunicipality("");
    setFormMunicipalities([]);
    const nextMunicipalities = await loadFormMunicipalities(value);
    if (nextMunicipalities) setFormMunicipalities(nextMunicipalities);
  }

  async function startEditing(pub: AdminPubListItem) {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/pubs/${pub.id}`);
      const body = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !body.pub) return setMessage(getAdminApiErrorMessage(locale, body));
      const detail = body.pub;
      const prefectureCode = detail.prefectureCode === null ? "" : String(detail.prefectureCode);
      const nextMunicipalities = await loadFormMunicipalities(prefectureCode);
      if (nextMunicipalities === null) return;
      setFormPrefecture(prefectureCode);
      setFormMunicipality(detail.municipalityCode ?? "");
      setFormMunicipalities(nextMunicipalities);
      setEditing(detail);
    } catch {
      setMessage(getAdminApiErrorMessage(locale, null));
    }
  }

  function resetEditor() {
    formMunicipalityRequest.current?.abort();
    formMunicipalityRequest.current = null;
    setEditing(null);
    setFormPrefecture("");
    setFormMunicipality("");
    setFormMunicipalities([]);
  }

  async function setPublication(pub: AdminPubListItem) {
    const isPublished = !pub.isPublished;
    const confirmation = isPublished ? t.admin.confirmPublish : t.admin.confirmUnpublish;
    if (!window.confirm(formatMessage(confirmation, { name: pub.name }))) return;
    setPublicationPending(pub.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/pubs/${pub.id}/publication`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished }),
      });
      const body = (await response.json().catch(() => ({}))) as PublicationResponse;
      if (!response.ok || !body.publication) {
        const missingFields = getMissingPublicationFields(body.missingFields, t.admin.publicationFields);
        setMessage(
          missingFields
            ? `${getAdminApiErrorMessage(locale, body)} ${formatMessage(t.admin.missingPublicationFields, { fields: missingFields })}`
            : getAdminApiErrorMessage(locale, body),
        );
        return;
      }
      setPubs((current) => current.map((item) => (item.id === pub.id ? { ...item, isPublished } : item)));
      setMessage(
        formatMessage(isPublished ? t.admin.publishedSuccess : t.admin.unpublishedSuccess, { name: pub.name }),
      );
      router.refresh();
    } catch {
      setMessage(getAdminApiErrorMessage(locale, null));
    } finally {
      setPublicationPending(null);
    }
  }

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (condition.name) params.set("name", condition.name);
    if (condition.prefectureCode) params.set("prefecture", String(condition.prefectureCode));
    if (condition.municipalityCode) params.set("municipality", condition.municipalityCode);
    if (condition.statusKey) params.set("status", condition.statusKey);
    if (condition.tagId) params.set("tag", condition.tagId);
    if (condition.isPublished !== undefined) params.set("published", String(condition.isPublished));
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/admin/pubs?${query}` : "/admin/pubs";
  }

  const values = editing
    ? {
        name: editing.translations.ja.name,
        nameReading: editing.translations.ja.nameReading,
        prefectureCode: editing.prefectureCode === null ? "" : String(editing.prefectureCode),
        municipalityCode: editing.municipalityCode ?? "",
        address: editing.translations.ja.address ?? "",
        latitude: editing.latitude === null ? "" : String(editing.latitude),
        longitude: editing.longitude === null ? "" : String(editing.longitude),
        tagIds: editing.tagIds,
        status: editing.status ?? "",
        websiteUrl: editing.websiteUrl || "",
        googleMapsUrl: editing.googleMapsUrl || "",
        instagramUrl: editing.instagramUrl || "",
      }
    : emptyPub;
  const pageOffset = (condition.page - 1) * initialPage.pageSize;
  const pageFrom = pubs.length === 0 ? 0 : pageOffset + 1;
  const pageTo = pubs.length === 0 ? 0 : Math.min(pageOffset + pubs.length, initialPage.total);
  return (
    <section className="admin-panel admin-wide">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Irish Pub Map</p>
          <h1>{t.admin.heading}</h1>
        </div>
      </div>
      {!databaseConfigured ? <p className="admin-error">{t.admin.databaseUnavailable}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <form className="admin-form admin-pub-form" onSubmit={save} key={editing?.id || "new"}>
        <h2>{editing ? t.admin.editPub : t.admin.addPub}</h2>
        <label>
          {t.admin.name}
          <input name="name" required defaultValue={values.name} />
        </label>
        <label>
          {t.admin.prefecture}
          <select
            name="prefectureCode"
            value={formPrefecture}
            onChange={(event) => void changeFormPrefecture(event.currentTarget.value)}
          >
            <option value="">{t.admin.selectPrefecture}</option>
            {prefectures.map((prefecture) => (
              <option key={prefecture.code} value={prefecture.code}>
                {prefecture.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.admin.municipality}
          <select
            name="municipalityCode"
            value={formMunicipality}
            disabled={!formPrefecture}
            onChange={(event) => setFormMunicipality(event.currentTarget.value)}
          >
            <option value="">{t.admin.allMunicipalities}</option>
            {formMunicipalities.map((municipality) => (
              <option key={municipality.code} value={municipality.code}>
                {municipality.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.admin.address}
          <input name="address" defaultValue={values.address} />
        </label>
        <label>
          {t.admin.latitude}
          <input name="latitude" type="number" step="any" defaultValue={values.latitude} />
        </label>
        <label>
          {t.admin.longitude}
          <input name="longitude" type="number" step="any" defaultValue={values.longitude} />
        </label>
        <label>
          {t.admin.tags}
          <select name="tagIds" multiple defaultValue={values.tagIds}>
            {tagOptions.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.admin.status}
          <select name="status" defaultValue={values.status}>
            <option value="">—</option>
            {statusOptions.map((status) => (
              <option key={status.code} value={status.key}>
                {status.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.admin.officialWebsite}
          <input name="websiteUrl" type="url" defaultValue={values.websiteUrl} />
        </label>
        <label>
          Google Maps
          <input name="googleMapsUrl" type="url" defaultValue={values.googleMapsUrl} />
        </label>
        <label>
          Instagram
          <input name="instagramUrl" type="url" defaultValue={values.instagramUrl} />
        </label>
        <div className="admin-actions">
          <button disabled={!databaseConfigured}>{editing ? t.admin.update : t.admin.add}</button>
          {editing ? (
            <button type="button" onClick={resetEditor}>
              {t.admin.cancel}
            </button>
          ) : null}
        </div>
      </form>
      <section className="admin-pub-search-section" aria-labelledby="admin-pub-search-heading">
        <h2 id="admin-pub-search-heading">{t.admin.pubSearchHeading}</h2>
        <form className="admin-pub-filters" action="/admin/pubs" method="get">
          <label>
            {t.admin.searchName}
            <input name="name" defaultValue={condition.name ?? ""} />
          </label>
          <label>
            {t.admin.prefecture}
            <select
              name="prefecture"
              value={selectedPrefecture}
              onChange={(event) => void changePrefecture(event.currentTarget.value)}
            >
              <option value="">{t.admin.allPrefectures}</option>
              {prefectures.map((prefecture) => (
                <option key={prefecture.code} value={prefecture.code}>
                  {prefecture.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.admin.municipality}
            <select
              name="municipality"
              value={selectedMunicipality}
              disabled={!selectedPrefecture}
              onChange={(event) => setSelectedMunicipality(event.currentTarget.value)}
            >
              <option value="">{t.admin.allMunicipalities}</option>
              {municipalities.map((municipality) => (
                <option key={municipality.code} value={municipality.code}>
                  {municipality.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.admin.status}
            <select name="status" defaultValue={condition.statusKey ?? ""}>
              <option value="">{t.admin.allStatuses}</option>
              {statusOptions.map((status) => (
                <option key={status.code} value={status.key}>
                  {status.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.admin.filterTag}
            <select name="tag" defaultValue={condition.tagId ?? ""}>
              <option value="">{t.admin.allTags}</option>
              {tagOptions.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.admin.publication}
            <select
              name="published"
              defaultValue={condition.isPublished === undefined ? "" : String(condition.isPublished)}
            >
              <option value="">{t.admin.allPublicationStates}</option>
              <option value="true">{t.admin.published}</option>
              <option value="false">{t.admin.unpublished}</option>
            </select>
          </label>
          <div className="admin-pub-filter-actions">
            <button type="submit">{t.admin.search}</button>
            <a href="/admin/pubs">{t.admin.clearFilters}</a>
          </div>
        </form>
      </section>
      <section className="admin-pub-results" aria-labelledby="admin-pub-results-heading">
        <h2 id="admin-pub-results-heading" aria-live="polite">
          {formatMessage(t.admin.adminPubResults, { count: initialPage.total })}
        </h2>
        {pubs.length === 0 ? (
          <p className="admin-empty">{t.admin.noAdminPubs}</p>
        ) : (
          <div className="admin-pub-table-wrap">
            <table className="admin-pub-table">
              <thead>
                <tr>
                  <th scope="col">{t.admin.name}</th>
                  <th scope="col">{t.admin.area}</th>
                  <th scope="col">{t.admin.status}</th>
                  <th scope="col">{t.admin.publication}</th>
                  <th scope="col">{t.admin.filterTag}</th>
                  <th scope="col">{t.admin.updatedAt}</th>
                  <th scope="col">{t.admin.operations}</th>
                </tr>
              </thead>
              <tbody>
                {pubs.map((pub) => {
                  const pending = publicationPending === pub.id;
                  return (
                    <tr key={pub.id}>
                      <th scope="row" data-label={t.admin.name}>
                        {pub.name}
                      </th>
                      <td data-label={t.admin.area}>{[pub.prefecture, pub.city].filter(Boolean).join(" ") || "—"}</td>
                      <td data-label={t.admin.status}>{pub.statusDisplayName || "—"}</td>
                      <td data-label={t.admin.publication}>
                        <span
                          className={`admin-publication-badge ${pub.isPublished ? "is-published" : "is-unpublished"}`}
                        >
                          {pub.isPublished ? t.admin.published : t.admin.unpublished}
                        </span>
                      </td>
                      <td data-label={t.admin.filterTag}>{pub.tagItems.map((tag) => tag.name).join(", ") || "—"}</td>
                      <td data-label={t.admin.updatedAt}>
                        {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(pub.updatedAt))}
                      </td>
                      <td data-label={t.admin.operations}>
                        <div className="admin-pub-row-actions">
                          <button type="button" onClick={() => void startEditing(pub)}>
                            {t.admin.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => void setPublication(pub)}
                            disabled={!databaseConfigured || pending}
                          >
                            {pending
                              ? pub.isPublished
                                ? t.admin.unpublishing
                                : t.admin.publishing
                              : pub.isPublished
                                ? t.admin.unpublish
                                : t.admin.publish}
                          </button>
                          <button type="button" onClick={() => void remove(pub)} disabled={!databaseConfigured}>
                            {t.admin.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {initialPage.total > 0 ? (
          <nav className="admin-pub-pagination" aria-label={t.admin.adminPubPagination}>
            {condition.page > 1 ? <a href={pageHref(condition.page - 1)}>{t.admin.previousPage}</a> : <span />}
            <span>
              {formatMessage(t.admin.pageSummary, {
                from: pageFrom,
                to: pageTo,
                total: initialPage.total,
              })}
            </span>
            {condition.page * initialPage.pageSize < initialPage.total ? (
              <a href={pageHref(condition.page + 1)}>{t.admin.nextPage}</a>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </section>
  );
}

function getMissingPublicationFields(value: unknown, labels: Record<string, string>) {
  if (!Array.isArray(value) || !value.every((field) => typeof field === "string")) return "";
  return value.map((field) => labels[field] ?? field).join(", ");
}
