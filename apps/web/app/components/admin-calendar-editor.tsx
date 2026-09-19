"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "../lib/i18n";
import { formatMessage, getTranslation } from "../lib/i18n";
import { getAdminCalendarApiErrorMessage } from "../lib/admin-api-client";
import { getCalendarPublicationMissingFields } from "../lib/calendar/publication";
import { formatCalendarDateRuleSummary } from "../lib/calendar/date-rule-summary";
import type {
  AdminCalendarEvent,
  AdminCalendarWriteInput,
  CalendarCategory,
  CalendarDateRuleDefinition,
} from "../lib/calendar/types";
import { AdminCalendarDateRuleEditor } from "./admin-calendar-date-rule-editor";
import { useUnsavedChangesWarning } from "../lib/use-unsaved-changes-warning";

type Props = {
  initialEvent: AdminCalendarEvent | null;
  databaseConfigured: boolean;
  locale: Locale;
};
type ApiResponse = {
  event?: AdminCalendarEvent;
  publication?: { isPublished: boolean; unchanged: boolean };
  fieldErrors?: unknown;
  missingFields?: unknown;
};
const CATEGORIES: readonly CalendarCategory[] = [
  "public_holiday",
  "culture",
  "tradition",
  "language",
  "literature",
  "history",
  "religion",
];

function emptyValues(): AdminCalendarWriteInput {
  return {
    category: null,
    dateRule: null,
    isPublicHoliday: false,
    featured: false,
    aliases: [],
    source: null,
    translations: { ja: { name: "", description: "" }, en: { name: "", description: "" } },
  };
}

function toValues(event: AdminCalendarEvent | null): AdminCalendarWriteInput {
  if (!event) return emptyValues();
  return {
    category: event.category,
    dateRule: event.dateRule,
    isPublicHoliday: event.isPublicHoliday,
    featured: event.featured,
    aliases: [...event.aliases],
    source: event.source,
    translations: { ja: { ...event.translations.ja }, en: { ...event.translations.en } },
  };
}

function serialize(id: string, values: AdminCalendarWriteInput) {
  return JSON.stringify({ id, ...values });
}

function asFieldErrors(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, code]) => typeof code === "string"));
}

function toMissingFields(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((field): field is string => typeof field === "string") : [];
}

/**
 * Calendar Event全体を日英・Date Rule・公開状態とともに管理します。
 * @param {Props} props - 編集対象、DB設定状態、表示ロケール。
 * @returns {JSX.Element} Calendar編集UI。
 */
export function AdminCalendarEditor({ initialEvent, databaseConfigured, locale }: Props) {
  const router = useRouter();
  const t = getTranslation(locale).admin;
  const c = t.calendar;
  const [eventId, setEventId] = useState(initialEvent?.id ?? "");
  const [contentId, setContentId] = useState(initialEvent?.id ?? null);
  const [values, setValues] = useState(() => toValues(initialEvent));
  const [savedSnapshot, setSavedSnapshot] = useState(() => serialize(initialEvent?.id ?? "", toValues(initialEvent)));
  const [status, setStatus] = useState<"draft" | "published">(initialEvent?.isPublished ? "published" : "draft");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverMissingFields, setServerMissingFields] = useState<string[]>([]);
  const isDirty = savedSnapshot !== serialize(eventId, values);
  const busy = saving || publishing || deleting;
  const missingFields = useMemo(() => getCalendarPublicationMissingFields(values), [values]);
  useUnsavedChangesWarning({ isDirty, message: t.unsavedChanges });

  function clearError(path: string) {
    setFieldErrors((current) => {
      if (!(path in current)) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
    setServerMissingFields((current) => current.filter((field) => field !== path));
  }
  function resetFeedback() {
    setMessage("");
    setError("");
    setFieldErrors({});
    setServerMissingFields([]);
  }
  function setTranslation(language: "ja" | "en", key: "name" | "description", value: string) {
    setValues((current) => ({
      ...current,
      translations: { ...current.translations, [language]: { ...current.translations[language], [key]: value } },
    }));
    clearError(`translations.${language}.${key}`);
  }
  function setRoot<K extends keyof AdminCalendarWriteInput>(key: K, value: AdminCalendarWriteInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    clearError(String(key));
  }
  function updateAlias(index: number, value: string) {
    setValues((current) => ({
      ...current,
      aliases: current.aliases.map((alias, aliasIndex) => (index === aliasIndex ? value : alias)),
    }));
    clearError(`aliases.${index}`);
  }
  function addAlias() {
    setValues((current) => ({ ...current, aliases: [...current.aliases, ""] }));
  }
  function removeAlias(index: number) {
    setValues((current) => ({ ...current, aliases: current.aliases.filter((_, aliasIndex) => aliasIndex !== index) }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !databaseConfigured) return;
    resetFeedback();
    setSaving(true);
    try {
      const response = await fetch(contentId ? `/api/admin/calendar/${contentId}` : "/api/admin/calendar", {
        method: contentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(contentId ? {} : { id: eventId }), ...values }),
      });
      const body = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !body.event) {
        setFieldErrors(asFieldErrors(body.fieldErrors));
        setServerMissingFields(toMissingFields(body.missingFields));
        setError(getAdminCalendarApiErrorMessage(locale, body));
        return;
      }
      const nextValues = toValues(body.event);
      const created = contentId === null;
      setEventId(body.event.id);
      setContentId(body.event.id);
      setValues(nextValues);
      setSavedSnapshot(serialize(body.event.id, nextValues));
      setStatus(body.event.isPublished ? "published" : "draft");
      setMessage(body.event.isPublished ? c.publishedSaved : c.draftSaved);
      if (created) router.push(`/admin/calendar/${body.event.id}`);
      router.refresh();
    } catch {
      setError(getAdminCalendarApiErrorMessage(locale, null));
    } finally {
      setSaving(false);
    }
  }

  async function changePublication(nextPublished: boolean) {
    if (!contentId || busy || !databaseConfigured || (nextPublished && isDirty)) return;
    const title = values.translations.ja.name || eventId;
    if (!window.confirm(formatMessage(nextPublished ? c.confirmPublish : c.confirmDraft, { title }))) return;
    resetFeedback();
    setPublishing(true);
    try {
      const response = await fetch(`/api/admin/calendar/${contentId}/publication`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: nextPublished }),
      });
      const body = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !body.publication) {
        setFieldErrors(asFieldErrors(body.fieldErrors));
        setServerMissingFields(toMissingFields(body.missingFields));
        setError(getAdminCalendarApiErrorMessage(locale, body));
        return;
      }
      setStatus(body.publication.isPublished ? "published" : "draft");
      setMessage(body.publication.isPublished ? c.publishedSuccess : c.returnedToDraft);
      router.refresh();
    } catch {
      setError(getAdminCalendarApiErrorMessage(locale, null));
    } finally {
      setPublishing(false);
    }
  }

  async function deleteEvent() {
    if (!contentId || busy || !databaseConfigured) return;
    const title = values.translations.ja.name || eventId;
    const confirmation = status === "published" ? c.confirmDeletePublished : c.confirmDeleteDraft;
    if (!window.confirm(formatMessage(confirmation, { title }))) return;
    resetFeedback();
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/calendar/${contentId}`, { method: "DELETE" });
      const body = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok) {
        setError(getAdminCalendarApiErrorMessage(locale, body));
        return;
      }
      router.push("/admin/calendar");
      router.refresh();
    } catch {
      setError(getAdminCalendarApiErrorMessage(locale, null));
    } finally {
      setDeleting(false);
    }
  }

  const publishBlocked = !contentId || isDirty || missingFields.length > 0 || busy || !databaseConfigured;
  const fieldLabel = (path: string) => c.publicationFields[path as keyof typeof c.publicationFields] ?? path;

  return (
    <section className="admin-panel admin-wide admin-calendar-editor">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Irish Calendar</p>
          <h1>{contentId ? c.editHeading : c.addHeading}</h1>
          <p>{contentId ? c.editDescription : c.addDescription}</p>
        </div>
        <span className={`admin-publication-badge ${status === "published" ? "is-published" : "is-unpublished"}`}>
          {status === "published" ? c.statusPublished : c.statusDraft}
        </span>
      </div>
      {!databaseConfigured ? <p className="admin-error">{c.databaseUnavailable}</p> : null}
      {Object.keys(fieldErrors).length > 0 ? (
        <p role="alert" className="admin-field-error">
          {formatMessage(c.fieldError, {
            field: Object.keys(fieldErrors).join(", "),
            reason: Object.values(fieldErrors).join(", "),
          })}
        </p>
      ) : null}
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
      {serverMissingFields.length > 0 ? (
        <p className="admin-field-error">
          {formatMessage(c.missingFields, { fields: serverMissingFields.map(fieldLabel).join(", ") })}
        </p>
      ) : null}
      <form className="admin-form admin-editor-form admin-calendar-form" onSubmit={save} aria-busy={busy}>
        <fieldset disabled={busy || !databaseConfigured}>
          <legend>{t.basicInformation}</legend>
          <label>
            {c.id}
            <input
              value={eventId}
              maxLength={100}
              disabled={contentId !== null}
              onChange={(event) => {
                setEventId(event.target.value);
                clearError("id");
              }}
            />
            <span className="admin-editor-note">{c.idHelp}</span>
          </label>
          <div className="admin-editor-grid">
            <label>
              {c.category}
              <select
                value={values.category ?? ""}
                onChange={(event) => setRoot("category", (event.target.value || null) as CalendarCategory | null)}
              >
                <option value="">{c.notSet}</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {c.categories[category]}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={values.isPublicHoliday}
                onChange={(event) => setRoot("isPublicHoliday", event.target.checked)}
              />
              {c.publicHoliday}
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={values.featured}
                onChange={(event) => setRoot("featured", event.target.checked)}
              />
              {c.featured}
            </label>
          </div>
        </fieldset>

        <AdminCalendarDateRuleEditor
          value={values.dateRule}
          locale={locale}
          disabled={busy || !databaseConfigured}
          onChange={(dateRule: CalendarDateRuleDefinition | null) => setRoot("dateRule", dateRule)}
        />
        <p className="admin-editor-note">{formatCalendarDateRuleSummary(values.dateRule, locale)}</p>

        {(["ja", "en"] as const).map((language) => (
          <fieldset key={language} disabled={busy || !databaseConfigured}>
            <legend>{language === "ja" ? c.japanese : c.english}</legend>
            <label>
              {c.name}
              <input
                value={values.translations[language].name}
                onChange={(event) => setTranslation(language, "name", event.target.value)}
              />
            </label>
            <label>
              {c.description}
              <textarea
                rows={5}
                value={values.translations[language].description}
                onChange={(event) => setTranslation(language, "description", event.target.value)}
              />
            </label>
          </fieldset>
        ))}

        <fieldset disabled={busy || !databaseConfigured}>
          <legend>{c.aliases}</legend>
          {values.aliases.map((alias, index) => (
            <div className="admin-calendar-alias-row" key={index}>
              <label>
                {`${c.aliases} ${index + 1}`}
                <input value={alias} onChange={(event) => updateAlias(index, event.target.value)} />
              </label>
              <button type="button" className="admin-secondary-action" onClick={() => removeAlias(index)}>
                {c.removeAlias}
              </button>
            </div>
          ))}
          <button type="button" className="admin-secondary-action" onClick={addAlias}>
            {c.addAlias}
          </button>
        </fieldset>

        <fieldset disabled={busy || !databaseConfigured}>
          <legend>{c.source}</legend>
          <label>
            {c.source}
            <input value={values.source ?? ""} onChange={(event) => setRoot("source", event.target.value || null)} />
          </label>
        </fieldset>

        <div className="admin-content-save-row">
          <button type="submit" disabled={busy || !databaseConfigured}>
            {saving ? t.saving : status === "published" ? c.savePublished : c.saveDraft}
          </button>
          <Link className="admin-secondary-action" href="/admin/calendar">
            {t.cancel}
          </Link>
          {contentId ? (
            <button
              type="button"
              className="admin-danger-action"
              disabled={busy || !databaseConfigured}
              onClick={() => void deleteEvent()}
            >
              {deleting ? c.deleting : c.delete}
            </button>
          ) : null}
          {isDirty ? <span className="admin-content-unsaved">{t.unsavedChanges}</span> : null}
        </div>
      </form>

      <section className="admin-content-publication" aria-labelledby="admin-calendar-publication-heading">
        <div>
          <h2 id="admin-calendar-publication-heading">{c.publicationHeading}</h2>
          <p>
            {missingFields.length === 0
              ? c.readyToPublish
              : formatMessage(c.missingFields, { fields: missingFields.map(fieldLabel).join(", ") })}
          </p>
          {isDirty && contentId ? <p className="admin-content-unsaved">{c.saveBeforePublish}</p> : null}
        </div>
        {status === "published" ? (
          <button
            type="button"
            className="admin-secondary-action"
            disabled={busy || !databaseConfigured}
            onClick={() => void changePublication(false)}
          >
            {publishing ? c.changingStatus : c.returnToDraft}
          </button>
        ) : (
          <button type="button" disabled={publishBlocked} onClick={() => void changePublication(true)}>
            {publishing ? c.changingStatus : c.publish}
          </button>
        )}
      </section>
    </section>
  );
}
