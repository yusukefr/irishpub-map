"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  ADMIN_TAG_KEY_MAX_LENGTH,
  ADMIN_TAG_NAME_MAX_LENGTH,
  type AdminTag,
  type AdminTagFieldErrors,
} from "@irishpub-map/shared/admin-tag";
import { getAdminTagApiErrorMessage } from "../lib/admin-api-client";
import { formatMessage, getTranslation, type Locale } from "../lib/i18n";
import { useUnsavedChangesWarning } from "../lib/use-unsaved-changes-warning";

type Props = { initialTags: AdminTag[]; databaseConfigured: boolean; locale: Locale };
type ApiResponse = { tag?: AdminTag; errorCode?: unknown; fieldErrors?: AdminTagFieldErrors };

/**
 * 管理者向けのタグ一覧、日英表示名の登録・編集、未使用タグ削除を管理します。
 * @param {Props} props - 初期タグ、DB設定状態、表示ロケール。
 * @returns {JSX.Element} タグ管理フォームと使用店舗数付き一覧。
 */
export function AdminTagManager({ initialTags, databaseConfigured, locale }: Props) {
  const t = getTranslation(locale).admin;
  const [tags, setTags] = useState(initialTags);
  const [editing, setEditing] = useState<AdminTag | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AdminTagFieldErrors>({});
  const [formDirty, setFormDirty] = useState(false);

  useUnsavedChangesWarning({ isDirty: formDirty, message: t.unsavedChanges });

  function resetFeedback() {
    setMessage("");
    setError("");
    setFieldErrors({});
  }

  function fieldErrorMessage(field: keyof AdminTagFieldErrors) {
    const code = fieldErrors[field];
    return code ? getAdminTagApiErrorMessage(locale, { fieldErrors: { [field]: code } }) : "";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyAction) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      ...(editing ? {} : { key: data.get("key") }),
      nameJa: data.get("nameJa"),
      nameEn: data.get("nameEn"),
    };
    resetFeedback();
    setBusyAction("save");
    try {
      const response = await fetch(editing ? `/api/admin/tags/${editing.id}` : "/api/admin/tags", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !result.tag) {
        setFieldErrors(asTagFieldErrors(result.fieldErrors));
        setError(getAdminTagApiErrorMessage(locale, result));
        return;
      }
      const savedTag = result.tag;
      setTags((current) =>
        (editing ? current.map((tag) => (tag.id === savedTag.id ? savedTag : tag)) : [...current, savedTag]).toSorted(
          (left, right) => left.key.localeCompare(right.key, "en"),
        ),
      );
      setEditing(null);
      setFormDirty(false);
      form.reset();
      setMessage(t.tagSaved);
    } catch {
      setError(getAdminTagApiErrorMessage(locale, null));
    } finally {
      setBusyAction(null);
    }
  }

  async function remove(tag: AdminTag) {
    if (busyAction || tag.pubCount > 0) return;
    if (!window.confirm(formatMessage(t.confirmTagDelete, { name: tag.nameJa }))) return;
    resetFeedback();
    setBusyAction("delete:" + tag.id);
    try {
      const response = await fetch(`/api/admin/tags/${tag.id}`, { method: "DELETE" });
      const result = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok) {
        setError(getAdminTagApiErrorMessage(locale, result));
        return;
      }
      setTags((current) => current.filter((currentTag) => currentTag.id !== tag.id));
      setFormDirty(false);
      if (editing?.id === tag.id) setEditing(null);
      setMessage(t.tagDeleted);
    } catch {
      setError(getAdminTagApiErrorMessage(locale, null));
    } finally {
      setBusyAction(null);
    }
  }

  const values = editing ?? { key: "", nameJa: "", nameEn: "" };
  return (
    <section className="admin-panel admin-wide">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Master data</p>
          <h1>{t.tagsHeading}</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormDirty(false);
            resetFeedback();
          }}
          disabled={Boolean(busyAction)}
        >
          {t.addTag}
        </button>
      </div>
      {!databaseConfigured ? <p className="admin-error">{t.databaseUnavailable}</p> : null}
      {message ? (
        <p role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="admin-error">
          {error}
        </p>
      ) : null}

      <form
        className="admin-form admin-tag-form"
        onSubmit={save}
        onChange={() => {
          setFormDirty(true);
          setFieldErrors({});
        }}
        key={editing?.id ?? "new"}
        aria-busy={Boolean(busyAction)}
      >
        <h2>{editing ? t.editTag : t.addTag}</h2>
        <fieldset disabled={Boolean(busyAction) || !databaseConfigured}>
          <label>
            {t.tagKey}
            <input
              id="admin-tag-key"
              name="key"
              required
              readOnly={Boolean(editing)}
              maxLength={ADMIN_TAG_KEY_MAX_LENGTH}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              defaultValue={values.key}
              aria-invalid={Boolean(fieldErrors.key)}
              aria-describedby={fieldErrors.key ? "admin-tag-key-error" : undefined}
            />
            {fieldErrors.key ? (
              <span id="admin-tag-key-error" className="admin-field-error">
                {fieldErrorMessage("key")}
              </span>
            ) : null}
          </label>
          <label>
            {t.tagNameJa}
            <input
              id="admin-tag-name-ja"
              name="nameJa"
              required
              maxLength={ADMIN_TAG_NAME_MAX_LENGTH}
              defaultValue={values.nameJa}
              aria-invalid={Boolean(fieldErrors.nameJa)}
              aria-describedby={fieldErrors.nameJa ? "admin-tag-name-ja-error" : undefined}
            />
            {fieldErrors.nameJa ? (
              <span id="admin-tag-name-ja-error" className="admin-field-error">
                {fieldErrorMessage("nameJa")}
              </span>
            ) : null}
          </label>
          <label>
            {t.tagNameEn}
            <input
              id="admin-tag-name-en"
              name="nameEn"
              maxLength={ADMIN_TAG_NAME_MAX_LENGTH}
              defaultValue={values.nameEn ?? ""}
              aria-invalid={Boolean(fieldErrors.nameEn)}
              aria-describedby={fieldErrors.nameEn ? "admin-tag-name-en-error" : undefined}
            />
            {fieldErrors.nameEn ? (
              <span id="admin-tag-name-en-error" className="admin-field-error">
                {fieldErrorMessage("nameEn")}
              </span>
            ) : null}
          </label>
          <div className="admin-actions">
            <button type="submit">{busyAction === "save" ? t.saving : editing ? t.update : t.add}</button>
            {editing ? (
              <button
                type="button"
                className="admin-secondary-action"
                onClick={() => {
                  if (formDirty && !window.confirm(t.unsavedChanges)) return;
                  setEditing(null);
                  setFormDirty(false);
                }}
              >
                {t.cancel}
              </button>
            ) : null}
          </div>
        </fieldset>
      </form>

      <section className="admin-tag-section" aria-labelledby="admin-tag-list-heading">
        <h2 id="admin-tag-list-heading">{formatMessage(t.listedTags, { count: tags.length })}</h2>
        {tags.length === 0 ? <p>{t.noTags}</p> : null}
        <ul className="admin-tag-list">
          {tags.map((tag) => (
            <li key={tag.id}>
              <dl>
                <div>
                  <dt>{t.tagKey}</dt>
                  <dd>
                    <code>{tag.key}</code>
                  </dd>
                </div>
                <div>
                  <dt>{t.tagNameJa}</dt>
                  <dd>{tag.nameJa}</dd>
                </div>
                <div>
                  <dt>{t.tagNameEn}</dt>
                  <dd>{tag.nameEn || t.notRegistered}</dd>
                </div>
                <div>
                  <dt>{t.tagPubCount}</dt>
                  <dd>{tag.pubCount}</dd>
                </div>
              </dl>
              <div className="admin-tag-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (formDirty && !window.confirm(t.unsavedChanges)) return;
                    setEditing(tag);
                    setFormDirty(false);
                    resetFeedback();
                  }}
                  disabled={Boolean(busyAction) || !databaseConfigured}
                >
                  {t.edit}
                </button>
                <button
                  type="button"
                  className="admin-danger-action"
                  onClick={() => void remove(tag)}
                  disabled={Boolean(busyAction) || !databaseConfigured || tag.pubCount > 0}
                  title={tag.pubCount > 0 ? t.tagInUse : undefined}
                >
                  {busyAction === `delete:${tag.id}` ? t.deleting : t.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function asTagFieldErrors(value: unknown): AdminTagFieldErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, code]) => typeof code === "string"),
  ) as AdminTagFieldErrors;
}
