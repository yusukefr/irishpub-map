"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CONTENT_BODY_MAX_LENGTH,
  CONTENT_HERO_ALT_MAX_LENGTH,
  CONTENT_HERO_CAPTION_MAX_LENGTH,
  CONTENT_CATEGORIES,
  CONTENT_KINDS,
  CONTENT_SLUG_MAX_LENGTH,
  CONTENT_SUMMARY_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH,
  type AdminContent,
  type AdminContentFieldErrors,
  type AdminContentWriteInput,
  type ContentCategory,
  type ContentKind,
  type ContentStatus,
} from "@irishpub-map/shared/admin-content";
import type { MediaAsset } from "@irishpub-map/shared/media";
import { MediaPicker } from "./media/media-picker";
import { getAdminContentApiErrorMessage } from "../lib/admin-api-client";
import { SafeMarkdownRenderer } from "../lib/content/renderer";
import { insertMediaImageMarkdown } from "../lib/content/editor-image";
import { formatMessage, getTranslation, type Locale } from "../lib/i18n";
import { useUnsavedChangesWarning } from "../lib/use-unsaved-changes-warning";

type Props = {
  initialContent: AdminContent | null;
  databaseConfigured: boolean;
  locale: Locale;
};

type ApiResponse = {
  content?: AdminContent;
  publication?: { id: string; status: ContentStatus; unchanged: boolean; publishedAt: string | null };
  errorCode?: unknown;
  fieldErrors?: unknown;
  missingFields?: unknown;
};

const emptyValues: AdminContentWriteInput = {
  kind: null,
  slug: null,
  category: null,
  heroImageAssetId: null,
  translations: {
    ja: { title: "", summary: "", bodyMarkdown: "", heroImageAlt: "", heroImageCaption: "" },
    en: { title: "", summary: "", bodyMarkdown: "", heroImageAlt: "", heroImageCaption: "" },
  },
};

function toValues(content: AdminContent | null): AdminContentWriteInput {
  if (!content) return emptyValues;
  return {
    kind: content.kind,
    slug: content.slug,
    category: content.category,
    heroImageAssetId: content.heroImageAssetId,
    translations: {
      ja: { ...content.translations.ja },
      en: { ...content.translations.en },
    },
  };
}

function serialize(values: AdminContentWriteInput) {
  return JSON.stringify(values);
}

function asFieldErrors(value: unknown): AdminContentFieldErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, code]) => typeof code === "string"),
  ) as AdminContentFieldErrors;
}

/**
 * Editorial Contentの日英本文、Preview、Draft / Publish操作を一画面で管理します。
 * @param {Props} props - 初期Content、DB設定状態、表示言語。
 * @returns {JSX.Element} Content編集フォームと安全なMarkdown Preview。
 */
export function AdminContentEditor({ initialContent, databaseConfigured, locale }: Props) {
  const router = useRouter();
  const t = getTranslation(locale).admin;
  const c = t.content;
  const [contentId, setContentId] = useState(initialContent?.id ?? null);
  const [values, setValues] = useState(() => toValues(initialContent));
  const [heroImage, setHeroImage] = useState<MediaAsset | null>(initialContent?.heroImage ?? null);
  const [pendingBodyImage, setPendingBodyImage] = useState<{ language: "ja" | "en"; media: MediaAsset } | null>(null);
  const [pendingBodyAlt, setPendingBodyAlt] = useState("");
  const [bodyImageUndo, setBodyImageUndo] = useState<{
    language: "ja" | "en";
    before: string;
    after: string;
    caret: number;
  } | null>(null);
  const markdownRefs = useRef<Record<"ja" | "en", HTMLTextAreaElement | null>>({ ja: null, en: null });
  const markdownSelections = useRef<Record<"ja" | "en", { start: number; end: number } | null>>({ ja: null, en: null });
  const [savedSnapshot, setSavedSnapshot] = useState(() => serialize(toValues(initialContent)));
  const [status, setStatus] = useState<ContentStatus>(initialContent?.status ?? "draft");
  const [publishedAt, setPublishedAt] = useState(initialContent?.publishedAt ?? null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AdminContentFieldErrors>({});
  const [serverMissingFields, setServerMissingFields] = useState<string[]>([]);
  const isDirty = savedSnapshot !== serialize(values);
  const busy = saving || publishing;
  const missingFields = useMemo(() => getPublicationMissingFields(values), [values]);

  useUnsavedChangesWarning({ isDirty, message: t.unsavedChanges });

  function setRootValue<K extends "kind" | "slug" | "category">(key: K, value: AdminContentWriteInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    clearFieldError(key);
  }

  function setTranslationValue(
    language: "ja" | "en",
    key: keyof AdminContentWriteInput["translations"]["ja"],
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [language]: { ...current.translations[language], [key]: value },
      },
    }));
    clearFieldError(`translations.${language}.${key}`);
  }

  function selectHeroImage(media: MediaAsset | null) {
    setValues((current) => {
      if (current.heroImageAssetId === media?.id) return current;
      return {
        ...current,
        heroImageAssetId: media?.id ?? null,
        translations: {
          ja: { ...current.translations.ja, heroImageAlt: "", heroImageCaption: "" },
          en: { ...current.translations.en, heroImageAlt: "", heroImageCaption: "" },
        },
      };
    });
    setHeroImage(media);
    clearFieldError("heroImageAssetId");
    for (const language of ["ja", "en"] as const) {
      clearFieldError(`translations.${language}.heroImageAlt`);
      clearFieldError(`translations.${language}.heroImageCaption`);
    }
  }

  function rememberMarkdownSelection(language: "ja" | "en", textarea: HTMLTextAreaElement) {
    markdownSelections.current[language] = { start: textarea.selectionStart, end: textarea.selectionEnd };
  }

  function insertBodyImage(language: "ja" | "en") {
    if (pendingBodyImage?.language !== language || !pendingBodyAlt.trim()) return;
    const current = values.translations[language].bodyMarkdown;
    const selection = markdownSelections.current[language] ?? { start: current.length, end: current.length };
    const inserted = insertMediaImageMarkdown(
      current,
      selection.start,
      selection.end,
      pendingBodyImage.media.id,
      pendingBodyAlt,
    );
    if (inserted.markdown.length > CONTENT_BODY_MAX_LENGTH) {
      setFieldErrors((errors) => ({ ...errors, [`translations.${language}.bodyMarkdown`]: "too_long" }));
      return;
    }
    setTranslationValue(language, "bodyMarkdown", inserted.markdown);
    setBodyImageUndo({ language, before: current, after: inserted.markdown, caret: selection.start });
    markdownSelections.current[language] = { start: inserted.caret, end: inserted.caret };
    setPendingBodyImage(null);
    setPendingBodyAlt("");
    requestAnimationFrame(() => {
      markdownRefs.current[language]?.focus();
      markdownRefs.current[language]?.setSelectionRange(inserted.caret, inserted.caret);
    });
  }

  function undoBodyImage(language: "ja" | "en") {
    if (bodyImageUndo?.language !== language || values.translations[language].bodyMarkdown !== bodyImageUndo.after)
      return;
    setTranslationValue(language, "bodyMarkdown", bodyImageUndo.before);
    const caret = bodyImageUndo.caret;
    setBodyImageUndo(null);
    requestAnimationFrame(() => {
      markdownRefs.current[language]?.focus();
      markdownRefs.current[language]?.setSelectionRange(caret, caret);
    });
  }

  function clearFieldError(path: string) {
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !databaseConfigured) return;
    resetFeedback();
    setSaving(true);
    try {
      const response = await fetch(contentId ? `/api/admin/content/${contentId}` : "/api/admin/content", {
        method: contentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !body.content) {
        setFieldErrors(asFieldErrors(body.fieldErrors));
        setServerMissingFields(toStringArray(body.missingFields));
        setError(getAdminContentApiErrorMessage(locale, body));
        return;
      }
      const savedValues = toValues(body.content);
      const created = contentId === null;
      setContentId(body.content.id);
      setValues(savedValues);
      setBodyImageUndo(null);
      setHeroImage(body.content.heroImage);
      setSavedSnapshot(serialize(savedValues));
      setStatus(body.content.status);
      setPublishedAt(body.content.publishedAt);
      setMessage(body.content.status === "published" ? c.publishedContentSaved : c.draftSaved);
      if (created) router.push(`/admin/content/${body.content.id}`);
      router.refresh();
    } catch {
      setError(getAdminContentApiErrorMessage(locale, null));
    } finally {
      setSaving(false);
    }
  }

  async function changePublication(nextStatus: ContentStatus) {
    if (!contentId || busy || !databaseConfigured || (nextStatus === "published" && isDirty)) return;
    const title = values.translations.ja.title || values.slug || c.untitled;
    const confirmation =
      nextStatus === "published"
        ? formatMessage(c.confirmPublish, { title })
        : formatMessage(c.confirmDraft, { title });
    if (!window.confirm(confirmation)) return;
    resetFeedback();
    setPublishing(true);
    try {
      const response = await fetch(`/api/admin/content/${contentId}/publication`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !body.publication) {
        setServerMissingFields(toStringArray(body.missingFields));
        setError(getAdminContentApiErrorMessage(locale, body));
        return;
      }
      setStatus(body.publication.status);
      setPublishedAt(body.publication.publishedAt);
      setMessage(body.publication.status === "published" ? c.publishedSuccess : c.returnedToDraft);
      router.refresh();
    } catch {
      setError(getAdminContentApiErrorMessage(locale, null));
    } finally {
      setPublishing(false);
    }
  }

  const publishBlocked = !contentId || isDirty || missingFields.length > 0 || busy || !databaseConfigured;

  return (
    <section className="admin-panel admin-wide admin-content-editor">
      <div className="admin-content-editor-heading">
        <div>
          <p className="eyebrow">Editorial content</p>
          <h1>{contentId ? c.editHeading : c.addHeading}</h1>
          <p>{contentId ? c.editDescription : c.addDescription}</p>
        </div>
        <span className={`admin-publication-badge ${status === "published" ? "is-published" : "is-unpublished"}`}>
          {status === "published" ? c.statusPublished : c.statusDraft}
        </span>
      </div>

      {!databaseConfigured ? <p className="admin-error">{t.editorUnavailable}</p> : null}
      {status === "published" ? <p className="admin-content-live-note">{c.publishedSaveNotice}</p> : null}
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
          {formatMessage(c.missingFields, {
            fields: serverMissingFields.map((field) => fieldLabel(field, c)).join(", "),
          })}
        </p>
      ) : null}

      <form className="admin-form admin-editor-form admin-content-form" onSubmit={save} aria-busy={busy}>
        <fieldset disabled={busy || !databaseConfigured}>
          <legend>{c.basicInformation}</legend>
          <div className="admin-editor-grid">
            <label>
              {c.kind}
              <select
                value={values.kind ?? ""}
                onChange={(event) => setRootValue("kind", (event.target.value || null) as ContentKind | null)}
                aria-invalid={Boolean(fieldErrors.kind)}
                aria-describedby={fieldErrorId("kind")}
              >
                <option value="">{c.notSelected}</option>
                {CONTENT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {c.kinds[kind]}
                  </option>
                ))}
              </select>
              <FieldError path="kind" errors={fieldErrors} label={c.kind} messages={c} />
            </label>
            <label>
              {c.category}
              <select
                value={values.category ?? ""}
                onChange={(event) => setRootValue("category", (event.target.value || null) as ContentCategory | null)}
                aria-invalid={Boolean(fieldErrors.category)}
                aria-describedby={fieldErrorId("category")}
              >
                <option value="">{c.notSelected}</option>
                {CONTENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {c.categories[category]}
                  </option>
                ))}
              </select>
              <FieldError path="category" errors={fieldErrors} label={c.category} messages={c} />
            </label>
          </div>
          <label>
            {c.slug}
            <input
              value={values.slug ?? ""}
              maxLength={CONTENT_SLUG_MAX_LENGTH}
              placeholder="split-the-g"
              onChange={(event) => setRootValue("slug", event.target.value || null)}
              aria-label={c.slug}
              aria-invalid={Boolean(fieldErrors.slug)}
              aria-describedby={`admin-content-slug-help ${fieldErrorId("slug")}`}
            />
            <span id="admin-content-slug-help" className="admin-editor-note">
              {c.slugHelp}
            </span>
            <FieldError path="slug" errors={fieldErrors} label={c.slug} messages={c} />
          </label>
        </fieldset>

        <fieldset disabled={busy || !databaseConfigured}>
          <legend>{c.heroImage}</legend>
          <p className="admin-editor-note">{c.heroImageRecommendedRatio}</p>
          {heroImage ? (
            <figure className="admin-content-hero-preview">
              <Image
                src={heroImage.url}
                alt={values.translations[locale].heroImageAlt || c.heroImagePreviewAlt}
                width={heroImage.width}
                height={heroImage.height}
                sizes="(max-width: 760px) calc(100vw - 32px), 520px"
              />
              <figcaption>{c.heroImageSelected}</figcaption>
            </figure>
          ) : null}
          <div className="admin-content-hero-actions">
            <MediaPicker
              locale={locale}
              selectedId={values.heroImageAssetId}
              triggerLabel={heroImage ? c.changeImage : c.selectImage}
              onSelect={selectHeroImage}
            />
            {heroImage ? (
              <button type="button" className="admin-secondary-action" onClick={() => selectHeroImage(null)}>
                {c.clearImage}
              </button>
            ) : null}
          </div>
          <FieldError path="heroImageAssetId" errors={fieldErrors} label={c.heroImage} messages={c} />
        </fieldset>

        {(["ja", "en"] as const).map((language) => {
          const translation = values.translations[language];
          return (
            <fieldset key={language} disabled={busy || !databaseConfigured}>
              <legend>{language === "ja" ? c.japaneseContent : c.englishContent}</legend>
              <label>
                {c.title}
                <input
                  value={translation.title}
                  maxLength={CONTENT_TITLE_MAX_LENGTH}
                  onChange={(event) => setTranslationValue(language, "title", event.target.value)}
                  aria-invalid={Boolean(fieldErrors[`translations.${language}.title`])}
                  aria-describedby={fieldErrorId(`translations.${language}.title`)}
                />
                <FieldError path={`translations.${language}.title`} errors={fieldErrors} label={c.title} messages={c} />
              </label>
              <label>
                {c.summary}
                <textarea
                  value={translation.summary}
                  maxLength={CONTENT_SUMMARY_MAX_LENGTH}
                  rows={3}
                  onChange={(event) => setTranslationValue(language, "summary", event.target.value)}
                  aria-invalid={Boolean(fieldErrors[`translations.${language}.summary`])}
                  aria-describedby={fieldErrorId(`translations.${language}.summary`)}
                />
                <FieldError
                  path={`translations.${language}.summary`}
                  errors={fieldErrors}
                  label={c.summary}
                  messages={c}
                />
              </label>
              <label>
                {c.heroImageAlt}
                <input
                  value={translation.heroImageAlt}
                  maxLength={CONTENT_HERO_ALT_MAX_LENGTH}
                  disabled={!values.heroImageAssetId}
                  onChange={(event) => setTranslationValue(language, "heroImageAlt", event.target.value)}
                  aria-invalid={Boolean(fieldErrors[`translations.${language}.heroImageAlt`])}
                  aria-describedby={fieldErrorId(`translations.${language}.heroImageAlt`)}
                />
                <FieldError
                  path={`translations.${language}.heroImageAlt`}
                  errors={fieldErrors}
                  label={c.heroImageAlt}
                  messages={c}
                />
              </label>
              <label>
                {c.heroImageCaption}
                <textarea
                  value={translation.heroImageCaption}
                  maxLength={CONTENT_HERO_CAPTION_MAX_LENGTH}
                  disabled={!values.heroImageAssetId}
                  rows={2}
                  onChange={(event) => setTranslationValue(language, "heroImageCaption", event.target.value)}
                  aria-invalid={Boolean(fieldErrors[`translations.${language}.heroImageCaption`])}
                  aria-describedby={fieldErrorId(`translations.${language}.heroImageCaption`)}
                />
                <FieldError
                  path={`translations.${language}.heroImageCaption`}
                  errors={fieldErrors}
                  label={c.heroImageCaption}
                  messages={c}
                />
              </label>
              <label>
                {c.bodyMarkdown}
                <textarea
                  ref={(node) => {
                    markdownRefs.current[language] = node;
                  }}
                  className="admin-content-markdown"
                  value={translation.bodyMarkdown}
                  maxLength={CONTENT_BODY_MAX_LENGTH}
                  rows={16}
                  onChange={(event) => {
                    setBodyImageUndo((current) => (current?.language === language ? null : current));
                    setTranslationValue(language, "bodyMarkdown", event.target.value);
                  }}
                  onSelect={(event) => rememberMarkdownSelection(language, event.currentTarget)}
                  onBlur={(event) => rememberMarkdownSelection(language, event.currentTarget)}
                  aria-label={c.bodyMarkdown}
                  aria-invalid={Boolean(fieldErrors[`translations.${language}.bodyMarkdown`])}
                  aria-describedby={`admin-content-${language}-markdown-help ${fieldErrorId(
                    `translations.${language}.bodyMarkdown`,
                  )}`}
                />
                <span id={`admin-content-${language}-markdown-help`} className="admin-editor-note">
                  {c.markdownHelp}
                </span>
                <FieldError
                  path={`translations.${language}.bodyMarkdown`}
                  errors={fieldErrors}
                  label={c.bodyMarkdown}
                  messages={c}
                />
              </label>
              <div className="admin-content-hero-actions">
                <MediaPicker
                  locale={locale}
                  selectedId={pendingBodyImage?.language === language ? pendingBodyImage.media.id : null}
                  triggerLabel={c.insertBodyImage}
                  onSelect={(media) => {
                    setPendingBodyImage({ language, media });
                    setPendingBodyAlt("");
                  }}
                />
                {bodyImageUndo?.language === language && translation.bodyMarkdown === bodyImageUndo.after ? (
                  <button type="button" className="admin-secondary-action" onClick={() => undoBodyImage(language)}>
                    {c.undoBodyImage}
                  </button>
                ) : null}
              </div>
              {pendingBodyImage?.language === language ? (
                <div className="admin-content-body-image-insert">
                  <figure className="admin-content-hero-preview">
                    <Image
                      src={pendingBodyImage.media.url}
                      alt=""
                      width={pendingBodyImage.media.width}
                      height={pendingBodyImage.media.height}
                      sizes="(max-width: 760px) calc(100vw - 32px), 520px"
                    />
                    <figcaption>{c.bodyImageSelected}</figcaption>
                  </figure>
                  <label>
                    {c.bodyImageAlt}
                    <input
                      value={pendingBodyAlt}
                      maxLength={CONTENT_HERO_ALT_MAX_LENGTH}
                      onChange={(event) => setPendingBodyAlt(event.target.value)}
                    />
                  </label>
                  <p className="admin-editor-note">{c.bodyImageAltHelp}</p>
                  <div className="admin-content-hero-actions">
                    <button type="button" disabled={!pendingBodyAlt.trim()} onClick={() => insertBodyImage(language)}>
                      {c.confirmBodyImage}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-action"
                      onClick={() => {
                        setPendingBodyImage(null);
                        setPendingBodyAlt("");
                      }}
                    >
                      {c.cancelBodyImage}
                    </button>
                  </div>
                </div>
              ) : null}
            </fieldset>
          );
        })}

        <div className="admin-content-save-row">
          <button type="submit" disabled={busy || !databaseConfigured}>
            {saving ? t.saving : status === "published" ? c.savePublished : c.saveDraft}
          </button>
          <button
            type="button"
            className="admin-secondary-action"
            aria-expanded={previewOpen}
            aria-controls="admin-content-preview"
            onClick={() => setPreviewOpen((current) => !current)}
          >
            {previewOpen ? c.closePreview : c.preview}
          </button>
          {isDirty ? <span className="admin-content-unsaved">{c.unsaved}</span> : null}
        </div>
      </form>

      {previewOpen ? (
        <section
          id="admin-content-preview"
          className="admin-content-preview"
          aria-labelledby="admin-content-preview-heading"
        >
          <div>
            <p className="eyebrow">Preview</p>
            <h2 id="admin-content-preview-heading">{c.previewHeading}</h2>
            <p>{c.previewDescription}</p>
          </div>
          <div className="admin-content-preview-grid">
            {(["ja", "en"] as const).map((language) => {
              const translation = values.translations[language];
              return (
                <article key={language} lang={language} className="admin-content-preview-pane">
                  <p className="admin-content-language">{language === "ja" ? c.japaneseContent : c.englishContent}</p>
                  <h3>{translation.title || c.untitled}</h3>
                  {translation.summary ? <p className="admin-content-preview-summary">{translation.summary}</p> : null}
                  {heroImage ? (
                    <figure className="admin-content-preview-hero">
                      <Image
                        src={heroImage.url}
                        alt={translation.heroImageAlt}
                        width={heroImage.width}
                        height={heroImage.height}
                        sizes="(max-width: 760px) calc(100vw - 32px), 520px"
                      />
                      {translation.heroImageCaption ? <figcaption>{translation.heroImageCaption}</figcaption> : null}
                    </figure>
                  ) : null}
                  <div className="content-prose">
                    {translation.bodyMarkdown ? (
                      <SafeMarkdownRenderer markdown={translation.bodyMarkdown} />
                    ) : (
                      <p>{c.emptyBody}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="admin-content-publication" aria-labelledby="admin-content-publication-heading">
        <div>
          <h2 id="admin-content-publication-heading">{c.publicationHeading}</h2>
          <p>
            {missingFields.length === 0
              ? c.readyToPublish
              : formatMessage(c.missingFields, {
                  fields: missingFields.map((field) => fieldLabel(field, c)).join(", "),
                })}
          </p>
          {publishedAt ? <p>{formatMessage(c.publishedAt, { date: formatDate(publishedAt, locale) })}</p> : null}
          {isDirty && contentId ? <p className="admin-content-unsaved">{c.saveBeforePublish}</p> : null}
        </div>
        {status === "published" ? (
          <button
            type="button"
            className="admin-secondary-action"
            disabled={busy || !databaseConfigured}
            onClick={() => void changePublication("draft")}
          >
            {publishing ? c.changingStatus : c.returnToDraft}
          </button>
        ) : (
          <button type="button" disabled={publishBlocked} onClick={() => void changePublication("published")}>
            {publishing ? t.publishing : c.publish}
          </button>
        )}
      </section>
    </section>
  );
}

function getPublicationMissingFields(values: AdminContentWriteInput) {
  const fields: string[] = [];
  if (!values.kind) fields.push("kind");
  if (!values.slug) fields.push("slug");
  if (!values.category) fields.push("category");
  for (const language of ["ja", "en"] as const) {
    for (const field of ["title", "summary", "bodyMarkdown"] as const) {
      if (!values.translations[language][field].trim()) fields.push(`translations.${language}.${field}`);
    }
    if (values.heroImageAssetId && !values.translations[language].heroImageAlt.trim()) {
      fields.push(`translations.${language}.heroImageAlt`);
    }
  }
  return fields;
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function fieldLabel(path: string, content: ReturnType<typeof getTranslation>["admin"]["content"]) {
  const [scope, language, field] = path.split(".");
  if (scope !== "translations" || !language || !field) {
    return path === "kind"
      ? content.kind
      : path === "slug"
        ? content.slug
        : path === "category"
          ? content.category
          : path;
  }
  const languageLabel = language === "ja" ? content.japaneseContent : content.englishContent;
  const fieldName =
    field === "title"
      ? content.title
      : field === "summary"
        ? content.summary
        : field === "heroImageAlt"
          ? content.heroImageAlt
          : field === "heroImageCaption"
            ? content.heroImageCaption
            : content.bodyMarkdown;
  return `${languageLabel}: ${fieldName}`;
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function FieldError({
  path,
  errors,
  label,
  messages,
}: {
  path: string;
  errors: AdminContentFieldErrors;
  label: string;
  messages: ReturnType<typeof getTranslation>["admin"]["content"];
}) {
  const code = errors[path];
  if (!code) return null;
  return (
    <span id={fieldErrorId(path)} className="admin-field-error">
      {formatMessage(messages.fieldError, { field: label, reason: messages.fieldErrorReasons[code] })}
    </span>
  );
}

function fieldErrorId(path: string) {
  return `admin-content-${path.replaceAll(".", "-")}-error`;
}
