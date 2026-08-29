"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminPub, AdminPubFieldErrors, AdminPubWriteInput } from "@irishpub-map/shared/admin-pub";
import type {
  MunicipalityOption,
  PrefectureOption,
  PubStatusOption,
  TagOption,
} from "@irishpub-map/shared/admin-master";
import { getAdminApiErrorMessage } from "../lib/admin-api-client";
import { formatMessage, getTranslation, type Locale } from "../lib/i18n";

type Props = {
  initialPub: AdminPub | null;
  prefectures: PrefectureOption[];
  municipalities: MunicipalityOption[];
  statuses: PubStatusOption[];
  tags: TagOption[];
  databaseConfigured: boolean;
  locale: Locale;
};

type EditorValues = {
  name: string;
  nameReading: string;
  address: string;
  englishName: string;
  englishAddress: string;
  prefectureCode: string;
  municipalityCode: string;
  latitude: string;
  longitude: string;
  status: string;
  websiteUrl: string;
  googleMapsUrl: string;
  instagramUrl: string;
  tagIds: string[];
};

type ErrorResponse = {
  errorCode?: unknown;
  fieldErrors?: unknown;
  missingFields?: unknown;
  pub?: AdminPub;
  publication?: unknown;
};

const emptyValues: EditorValues = {
  name: "",
  nameReading: "",
  address: "",
  englishName: "",
  englishAddress: "",
  prefectureCode: "",
  municipalityCode: "",
  latitude: "",
  longitude: "",
  status: "",
  websiteUrl: "",
  googleMapsUrl: "",
  instagramUrl: "",
  tagIds: [],
};

function toEditorValues(pub: AdminPub | null): EditorValues {
  if (!pub) return emptyValues;
  return {
    name: pub.translations.ja.name,
    nameReading: pub.translations.ja.nameReading ?? "",
    address: pub.translations.ja.address ?? "",
    englishName: pub.translations.en?.name ?? "",
    englishAddress: pub.translations.en?.address ?? "",
    prefectureCode: pub.prefectureCode === null ? "" : String(pub.prefectureCode),
    municipalityCode: pub.municipalityCode ?? "",
    latitude: pub.latitude === null ? "" : String(pub.latitude),
    longitude: pub.longitude === null ? "" : String(pub.longitude),
    status: pub.status ?? "",
    websiteUrl: pub.websiteUrl ?? "",
    googleMapsUrl: pub.googleMapsUrl ?? "",
    instagramUrl: pub.instagramUrl ?? "",
    tagIds: pub.tagIds,
  };
}

function toInput(values: EditorValues, englishEnabled: boolean): AdminPubWriteInput {
  return {
    prefectureCode: values.prefectureCode ? Number(values.prefectureCode) : null,
    municipalityCode: values.municipalityCode || null,
    latitude: values.latitude ? Number(values.latitude) : null,
    longitude: values.longitude ? Number(values.longitude) : null,
    websiteUrl: values.websiteUrl.trim() || null,
    googleMapsUrl: values.googleMapsUrl.trim() || null,
    instagramUrl: values.instagramUrl.trim() || null,
    status: (values.status || null) as AdminPubWriteInput["status"],
    translations: {
      ja: {
        name: values.name.trim(),
        nameReading: values.nameReading.trim() || null,
        address: values.address.trim() || null,
      },
      en: englishEnabled
        ? {
            name: values.englishName.trim(),
            nameReading: null,
            address: values.englishAddress.trim() || null,
          }
        : null,
    },
    tagIds: values.tagIds,
  };
}

function asFieldErrors(value: unknown): AdminPubFieldErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, code]) => typeof code === "string"),
  ) as AdminPubFieldErrors;
}

/**
 * 店舗の新規登録・編集を行う共通フォームです。公開操作と削除は専用APIへ委譲し、保存中の二重操作を防止します。
 * @param {Props} props - 店舗詳細、参照マスタ、DB設定、表示言語。
 * @returns {JSX.Element} セクション化された店舗編集フォーム。
 */
export function AdminPubEditor({
  initialPub,
  prefectures,
  municipalities: initialMunicipalities,
  statuses,
  tags,
  databaseConfigured,
  locale,
}: Props) {
  const t = getTranslation(locale);
  const router = useRouter();
  const editing = initialPub !== null;
  const [values, setValues] = useState(() => toEditorValues(initialPub));
  const [isPublished, setIsPublished] = useState(initialPub?.isPublished ?? false);
  const [englishEnabled, setEnglishEnabled] = useState(initialPub ? initialPub.translations.en !== null : false);
  const [municipalities, setMunicipalities] = useState(initialMunicipalities);
  const [municipalitySearch, setMunicipalitySearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AdminPubFieldErrors>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const municipalityRequest = useRef<AbortController | null>(null);
  const busy = saving || publishing || deleting;

  useEffect(() => () => municipalityRequest.current?.abort(), []);

  const filteredMunicipalities = useMemo(() => {
    const query = municipalitySearch.trim().toLocaleLowerCase(locale);
    return query
      ? municipalities.filter((municipality) => municipality.name.toLocaleLowerCase(locale).includes(query))
      : municipalities;
  }, [locale, municipalitySearch, municipalities]);
  const filteredTags = useMemo(() => {
    const query = tagSearch.trim().toLocaleLowerCase(locale);
    return query ? tags.filter((tag) => tag.name.toLocaleLowerCase(locale).includes(query)) : tags;
  }, [locale, tagSearch, tags]);

  function setValue<K extends keyof EditorValues>(key: K, value: EditorValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      const paths: Partial<Record<keyof EditorValues, string[]>> = {
        name: ["name", "translations.ja.name"],
        address: ["address", "translations.ja.address"],
        englishName: ["translations.en.name"],
        englishAddress: ["translations.en.address"],
      };
      for (const path of paths[key] ?? [String(key)]) delete next[path];
      return next;
    });
  }

  async function changePrefecture(prefectureCode: string) {
    municipalityRequest.current?.abort();
    setValue("prefectureCode", prefectureCode);
    setValue("municipalityCode", "");
    setMunicipalities([]);
    if (!prefectureCode) return;
    const controller = new AbortController();
    municipalityRequest.current = controller;
    try {
      const response = await fetch(
        `/api/admin/master/municipalities?prefectureCode=${encodeURIComponent(prefectureCode)}`,
        { signal: controller.signal },
      );
      const body = (await response.json().catch(() => ({}))) as { municipalities?: unknown };
      if (controller.signal.aborted) return;
      if (!response.ok || !Array.isArray(body.municipalities)) {
        setMessage(getAdminApiErrorMessage(locale, body));
        return;
      }
      setMunicipalities(body.municipalities as MunicipalityOption[]);
    } catch {
      if (!controller.signal.aborted) setMessage(getAdminApiErrorMessage(locale, null));
    } finally {
      if (municipalityRequest.current === controller) municipalityRequest.current = null;
    }
  }

  async function save() {
    if (busy || !databaseConfigured) return;
    setSaving(true);
    setMessage("");
    setFieldErrors({});
    setMissingFields([]);
    try {
      const response = await fetch(editing ? `/api/admin/pubs/${initialPub.id}` : "/api/admin/pubs", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toInput(values, englishEnabled)),
      });
      const body = (await response.json().catch(() => ({}))) as ErrorResponse;
      if (!response.ok || !body.pub) {
        setFieldErrors(asFieldErrors(body.fieldErrors));
        setMissingFields(
          Array.isArray(body.missingFields)
            ? body.missingFields.filter((field): field is string => typeof field === "string")
            : [],
        );
        setMessage(getAdminApiErrorMessage(locale, body));
        return;
      }
      setValues(toEditorValues(body.pub));
      setIsPublished(body.pub.isPublished);
      setEnglishEnabled(body.pub.translations.en !== null);
      setMessage(editing ? t.admin.updatedSuccess : t.admin.createdSuccess);
      if (!editing) router.push(`/admin/pubs/${body.pub.id}/edit`);
      router.refresh();
    } catch {
      setMessage(getAdminApiErrorMessage(locale, null));
    } finally {
      setSaving(false);
    }
  }

  async function changePublication(nextPublished: boolean) {
    if (!initialPub || busy || !databaseConfigured) return;
    const confirmation = nextPublished ? t.admin.confirmPublish : t.admin.confirmUnpublish;
    if (!window.confirm(formatMessage(confirmation, { name: values.name }))) return;
    setPublishing(true);
    setMessage("");
    setMissingFields([]);
    try {
      const response = await fetch(`/api/admin/pubs/${initialPub.id}/publication`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: nextPublished }),
      });
      const body = (await response.json().catch(() => ({}))) as ErrorResponse;
      if (!response.ok || !body.publication) {
        setMissingFields(
          Array.isArray(body.missingFields)
            ? body.missingFields.filter((field): field is string => typeof field === "string")
            : [],
        );
        setMessage(getAdminApiErrorMessage(locale, body));
        return;
      }
      setIsPublished(nextPublished);
      setMessage(
        formatMessage(nextPublished ? t.admin.publishedSuccess : t.admin.unpublishedSuccess, { name: values.name }),
      );
      router.refresh();
    } catch {
      setMessage(getAdminApiErrorMessage(locale, null));
    } finally {
      setPublishing(false);
    }
  }

  async function remove() {
    if (!initialPub || busy || !databaseConfigured) return;
    if (!window.confirm(formatMessage(t.admin.confirmDeleteDetails, { name: values.name }))) return;
    setDeleting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/pubs/${initialPub.id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => ({}))) as ErrorResponse;
      if (!response.ok) {
        setMessage(getAdminApiErrorMessage(locale, body));
        return;
      }
      router.push("/admin/pubs");
    } catch {
      setMessage(getAdminApiErrorMessage(locale, null));
    } finally {
      setDeleting(false);
    }
  }

  function toggleTag(tagId: string) {
    setValues((current) => ({
      ...current,
      tagIds: current.tagIds.includes(tagId) ? current.tagIds.filter((id) => id !== tagId) : [...current.tagIds, tagId],
    }));
  }

  function errorFor(...keys: string[]) {
    return keys.find((key) => fieldErrors[key]);
  }

  const labels = t.admin.publicationFields as Record<string, string>;
  const missingLabel = missingFields.map((field) => labels[field] ?? field).join(", ");
  return (
    <section className="admin-panel admin-wide admin-editor" aria-labelledby="admin-pub-editor-heading">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Irish Pub Map</p>
          <h1 id="admin-pub-editor-heading">{editing ? t.admin.editPub : t.admin.addPub}</h1>
        </div>
        {editing ? (
          <span className={`admin-publication-badge ${isPublished ? "is-published" : "is-unpublished"}`}>
            {isPublished ? t.admin.published : t.admin.unpublished}
          </span>
        ) : null}
      </div>
      {!databaseConfigured ? <p className="admin-error">{t.admin.databaseUnavailable}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {Object.keys(fieldErrors).length > 0 ? (
        <ul className="admin-field-errors" role="alert">
          {Object.keys(fieldErrors).map((field) => (
            <li key={field}>
              {labels[field] ?? field}: {t.admin.errors.validation_error}
            </li>
          ))}
        </ul>
      ) : null}
      {missingLabel ? (
        <p className="admin-error" role="alert">
          {formatMessage(t.admin.missingPublicationFields, { fields: missingLabel })}
        </p>
      ) : null}
      {!databaseConfigured ? <p className="admin-error">{t.admin.editorUnavailable}</p> : null}
      <form
        className="admin-form admin-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset>
          <legend>{t.admin.basicInformation}</legend>
          <label htmlFor="admin-pub-name">{t.admin.name}</label>
          <input
            id="admin-pub-name"
            value={values.name}
            onChange={(event) => setValue("name", event.target.value)}
            required
            aria-invalid={Boolean(errorFor("name", "translations.ja.name"))}
            aria-describedby={errorFor("name", "translations.ja.name") ? "admin-pub-name-error" : undefined}
          />
          {errorFor("name", "translations.ja.name") ? (
            <FieldError id="admin-pub-name-error" message={t.admin.errors.validation_error} />
          ) : null}
          <label htmlFor="admin-pub-status">{t.admin.status}</label>
          <select
            id="admin-pub-status"
            value={values.status}
            onChange={(event) => setValue("status", event.target.value)}
          >
            <option value="">—</option>
            {statuses.map((status) => (
              <option key={status.code} value={status.key}>
                {status.name}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend>{t.admin.location}</legend>
          <label htmlFor="admin-pub-prefecture">{t.admin.prefecture}</label>
          <select
            id="admin-pub-prefecture"
            value={values.prefectureCode}
            onChange={(event) => void changePrefecture(event.target.value)}
          >
            <option value="">{t.admin.selectPrefecture}</option>
            {prefectures.map((prefecture) => (
              <option key={prefecture.code} value={prefecture.code}>
                {prefecture.name}
              </option>
            ))}
          </select>
          <label htmlFor="admin-pub-municipality-search">{t.admin.searchMunicipality}</label>
          <input
            id="admin-pub-municipality-search"
            value={municipalitySearch}
            onChange={(event) => setMunicipalitySearch(event.target.value)}
            placeholder={t.admin.searchMunicipalityPlaceholder}
            disabled={!values.prefectureCode}
          />
          <label htmlFor="admin-pub-municipality">{t.admin.municipality}</label>
          <select
            id="admin-pub-municipality"
            value={values.municipalityCode}
            onChange={(event) => setValue("municipalityCode", event.target.value)}
            disabled={!values.prefectureCode}
          >
            <option value="">{t.admin.selectMunicipality}</option>
            {filteredMunicipalities.map((municipality) => (
              <option key={municipality.code} value={municipality.code}>
                {municipality.name}
              </option>
            ))}
          </select>
          <div className="admin-editor-grid">
            <label htmlFor="admin-pub-latitude">
              {t.admin.latitude}
              <input
                id="admin-pub-latitude"
                type="number"
                step="any"
                value={values.latitude}
                onChange={(event) => setValue("latitude", event.target.value)}
              />
            </label>
            <label htmlFor="admin-pub-longitude">
              {t.admin.longitude}
              <input
                id="admin-pub-longitude"
                type="number"
                step="any"
                value={values.longitude}
                onChange={(event) => setValue("longitude", event.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>{t.admin.japanese}</legend>
          <label htmlFor="admin-pub-name-reading">
            {t.admin.nameReading}
            <input
              id="admin-pub-name-reading"
              value={values.nameReading}
              onChange={(event) => setValue("nameReading", event.target.value)}
            />
          </label>
          <label htmlFor="admin-pub-address">
            {t.admin.address}
            <input
              id="admin-pub-address"
              value={values.address}
              onChange={(event) => setValue("address", event.target.value)}
              aria-invalid={Boolean(errorFor("address", "translations.ja.address"))}
              aria-describedby={errorFor("address", "translations.ja.address") ? "admin-pub-address-error" : undefined}
            />
          </label>
          {errorFor("address", "translations.ja.address") ? (
            <FieldError id="admin-pub-address-error" message={t.admin.errors.validation_error} />
          ) : null}
        </fieldset>

        <fieldset>
          <legend>{t.admin.english}</legend>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={englishEnabled}
              onChange={(event) => setEnglishEnabled(event.target.checked)}
            />
            {t.admin.registerEnglish}
          </label>
          {englishEnabled ? (
            <>
              <label htmlFor="admin-pub-english-name">
                {t.admin.englishName}
                <input
                  id="admin-pub-english-name"
                  value={values.englishName}
                  onChange={(event) => setValue("englishName", event.target.value)}
                  required
                  aria-invalid={Boolean(errorFor("englishName", "translations.en.name"))}
                  aria-describedby={
                    errorFor("englishName", "translations.en.name") ? "admin-pub-english-name-error" : undefined
                  }
                />
              </label>
              {errorFor("englishName", "translations.en.name") ? (
                <FieldError id="admin-pub-english-name-error" message={t.admin.errors.validation_error} />
              ) : null}
              <label htmlFor="admin-pub-english-address">
                {t.admin.englishAddress}
                <input
                  id="admin-pub-english-address"
                  value={values.englishAddress}
                  onChange={(event) => setValue("englishAddress", event.target.value)}
                  required
                  aria-invalid={Boolean(errorFor("englishAddress", "translations.en.address"))}
                  aria-describedby={
                    errorFor("englishAddress", "translations.en.address")
                      ? "admin-pub-english-address-error"
                      : undefined
                  }
                />
              </label>
              {errorFor("englishAddress", "translations.en.address") ? (
                <FieldError id="admin-pub-english-address-error" message={t.admin.errors.validation_error} />
              ) : null}
            </>
          ) : (
            <p className="admin-editor-note">{t.admin.englishNotRegistered}</p>
          )}
        </fieldset>

        <fieldset>
          <legend>{t.admin.externalLinks}</legend>
          <label htmlFor="admin-pub-website">
            {t.admin.officialWebsite}
            <input
              id="admin-pub-website"
              type="url"
              value={values.websiteUrl}
              onChange={(event) => setValue("websiteUrl", event.target.value)}
              aria-invalid={Boolean(errorFor("websiteUrl"))}
            />
          </label>
          <label htmlFor="admin-pub-google-maps">
            Google Maps
            <input
              id="admin-pub-google-maps"
              type="url"
              value={values.googleMapsUrl}
              onChange={(event) => setValue("googleMapsUrl", event.target.value)}
              aria-invalid={Boolean(errorFor("googleMapsUrl"))}
            />
          </label>
          <label htmlFor="admin-pub-instagram">
            Instagram
            <input
              id="admin-pub-instagram"
              type="url"
              value={values.instagramUrl}
              onChange={(event) => setValue("instagramUrl", event.target.value)}
              aria-invalid={Boolean(errorFor("instagramUrl"))}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>{t.admin.tagsSection}</legend>
          <label htmlFor="admin-pub-tag-search">
            {t.admin.searchTags}
            <input
              id="admin-pub-tag-search"
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
              placeholder={t.admin.searchTagsPlaceholder}
            />
          </label>
          <div className="admin-editor-tags" aria-label={t.admin.tags}>
            {filteredTags.map((tag) => (
              <label className="admin-checkbox" key={tag.id}>
                <input type="checkbox" checked={values.tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
                {tag.name}
              </label>
            ))}
            {filteredTags.length === 0 ? <p className="admin-editor-note">{t.admin.noTagOptions}</p> : null}
          </div>
        </fieldset>

        <div className="admin-actions">
          <button type="submit" disabled={busy || !databaseConfigured}>
            {saving ? t.admin.saving : editing ? t.admin.update : t.admin.add}
          </button>
          <a className="admin-pub-filter-actions" href="/admin/pubs">
            {t.admin.cancel}
          </a>
          {editing ? (
            <button
              type="button"
              className="admin-danger-action"
              onClick={() => void remove()}
              disabled={busy || !databaseConfigured}
            >
              {deleting ? t.admin.deleting : t.admin.delete}
            </button>
          ) : null}
        </div>
      </form>
      {editing ? (
        <div className="admin-editor-publication-actions">
          <h2>{t.admin.publication}</h2>
          <button
            type="button"
            onClick={() => void changePublication(!isPublished)}
            disabled={busy || !databaseConfigured}
          >
            {publishing ? t.admin.publishing : isPublished ? t.admin.unpublish : t.admin.publish}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <span id={id} className="admin-field-error" role="alert">
      {message}
    </span>
  );
}
