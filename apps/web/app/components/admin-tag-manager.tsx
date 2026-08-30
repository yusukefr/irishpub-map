"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  ADMIN_TAG_KEY_MAX_LENGTH,
  ADMIN_TAG_NAME_MAX_LENGTH,
  type AdminTagTranslations,
  type AdminTag,
  type AdminTagFieldErrors,
} from "@irishpub-map/shared/admin-tag";
import { REQUIRED_TRANSLATION_LOCALE } from "@irishpub-map/shared/locale";
import { getAdminTagApiErrorMessage } from "../lib/admin-api-client";
import { formatMessage, getTranslation, LANGUAGE_OPTIONS, type Locale } from "../lib/i18n";
import { useUnsavedChangesWarning } from "../lib/use-unsaved-changes-warning";

type Props = { initialTags: AdminTag[]; databaseConfigured: boolean; locale: Locale };
type ApiResponse = { tag?: AdminTag; errorCode?: unknown; fieldErrors?: AdminTagFieldErrors };

/**
 * 管理者向けのタグ一覧、日英表示名の登録・編集、未使用タグ削除を管理します。
 * @param {Props} props - 初期タグ、DB設定状態、表示ロケール。
 * @returns {JSX.Element} タグ管理フォームと使用店舗数付き一覧。
 */
export function AdminTagManager({ initialTags, databaseConfigured, locale }: Props) {
  const translation = getTranslation(locale);
  const t = translation.admin;
  const languageLabels = translation.language;
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
      translations: Object.fromEntries(
        LANGUAGE_OPTIONS.map(({ locale }) => [locale, data.get(`translations.${locale}`)]),
      ),
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
    if (!window.confirm(formatMessage(t.confirmTagDelete, { name: tag.translations[REQUIRED_TRANSLATION_LOCALE] })))
      return;
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
      if (editing?.id === tag.id) {
        setEditing(null);
        setFormDirty(false);
      }
      setMessage(t.tagDeleted);
    } catch {
      setError(getAdminTagApiErrorMessage(locale, null));
    } finally {
      setBusyAction(null);
    }
  }

  const values = editing ?? { key: "", translations: {} };
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
            if (formDirty && !window.confirm(t.unsavedChanges)) return;
            setEditing(null);
            setFormDirty(false);
            resetFeedback();
          }}
          disabled={Boolean(busyAction) || !editing}
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
          {LANGUAGE_OPTIONS.map(({ locale: translationLocale }) => (
            <TranslationField
              key={translationLocale}
              locale={translationLocale}
              values={values.translations}
              fieldErrors={fieldErrors}
              required={translationLocale === REQUIRED_TRANSLATION_LOCALE}
              label={languageLabels[translationLocale]}
              optionalLabel={t.translationOptional}
              errorMessage={fieldErrorMessage}
            />
          ))}
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
                {LANGUAGE_OPTIONS.map(({ locale: translationLocale }) => (
                  <div key={translationLocale}>
                    <dt>{languageLabels[translationLocale]}</dt>
                    <dd>{tag.translations[translationLocale] ?? t.notRegistered}</dd>
                  </div>
                ))}
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
                {tag.pubCount === 0 ? (
                  <button
                    type="button"
                    className="admin-danger-action"
                    onClick={() => void remove(tag)}
                    disabled={Boolean(busyAction) || !databaseConfigured}
                  >
                    {busyAction === `delete:${tag.id}` ? t.deleting : t.delete}
                  </button>
                ) : (
                  <span className="admin-action-note">{t.tagInUse}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

type TranslationFieldProps = {
  locale: Locale;
  values: Partial<AdminTagTranslations>;
  fieldErrors: AdminTagFieldErrors;
  required: boolean;
  label: string;
  optionalLabel: string;
  errorMessage: (field: keyof AdminTagFieldErrors) => string;
};

function TranslationField({
  locale,
  values,
  fieldErrors,
  required,
  label,
  optionalLabel,
  errorMessage,
}: TranslationFieldProps) {
  const field = ("translations." + locale) as keyof AdminTagFieldErrors;
  const inputId = "admin-tag-translation-" + locale;
  const errorId = inputId + "-error";
  const hasError = Boolean(fieldErrors[field]);
  return (
    <label>
      {label}
      {required ? "" : optionalLabel}
      <input
        id={inputId}
        name={field}
        required={required}
        maxLength={ADMIN_TAG_NAME_MAX_LENGTH}
        defaultValue={values[locale] ?? ""}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
      />
      {hasError ? (
        <span id={errorId} className="admin-field-error">
          {errorMessage(field)}
        </span>
      ) : null}
    </label>
  );
}

function asTagFieldErrors(value: unknown): AdminTagFieldErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, code]) => typeof code === "string"),
  ) as AdminTagFieldErrors;
}
