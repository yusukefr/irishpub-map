"use client";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AdminContentListItem } from "@irishpub-map/shared/admin-content";
import {
  QUIZ_CATEGORIES,
  QUIZ_CHOICE_ID_MAX_LENGTH,
  type AdminQuizQuestion,
  type AdminQuizWriteInput,
} from "../lib/quiz/types";
import { getAdminQuizApiErrorMessage } from "../lib/admin-api-client";
import { formatMessage, getTranslation, type Locale } from "../lib/i18n";
import { useUnsavedChangesWarning } from "../lib/use-unsaved-changes-warning";
import { getQuizPublicationMissingFields } from "../lib/quiz/publication";
type Props = {
  initialQuestion: AdminQuizQuestion | null;
  databaseConfigured: boolean;
  locale: Locale;
  relatedGuides: readonly AdminContentListItem[];
};
type ApiResponse = {
  question?: AdminQuizQuestion;
  publication?: { id: string; isPublished: boolean; unchanged: boolean };
  fieldErrors?: unknown;
  missingFields?: unknown;
};
const emptyValues: AdminQuizWriteInput = {
  category: null,
  specialDate: null,
  correctChoiceId: null,
  sourceUrl: null,
  relatedContentId: null,
  translations: {
    ja: { question: "", explanation: "", sourceLabel: "" },
    en: { question: "", explanation: "", sourceLabel: "" },
  },
  choices: [],
};
function toValues(question: AdminQuizQuestion | null): AdminQuizWriteInput {
  if (!question) return emptyValues;
  return {
    category: question.category,
    specialDate: question.specialDate,
    correctChoiceId: question.correctChoiceId,
    sourceUrl: question.sourceUrl,
    relatedContentId: question.relatedContentId,
    translations: { ja: { ...question.translations.ja }, en: { ...question.translations.en } },
    choices: question.choices.map((choice) => ({ ...choice, translations: { ...choice.translations } })),
  };
}
function toPayload(values: AdminQuizWriteInput) {
  return {
    ...values,
    choices: values.choices.map(({ id: choiceId, translations }) => ({ id: choiceId, translations })),
  };
}
function serialize(values: AdminQuizWriteInput) {
  return JSON.stringify(values);
}
function asFieldErrors(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, code]) => typeof code === "string"));
}
function toMissingFields(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((field): field is string => typeof field === "string") : [];
}
function fieldLabel(path: string, labels: Record<string, string>) {
  const [scope, language, field] = path.split(".");
  if (scope === "translations" && language && field) {
    const suffix = field === "question" ? "questionJa" : field === "explanation" ? "explanationJa" : "sourceLabelJa";
    return labels[language === "ja" ? suffix : suffix.replace(/Ja$/, "En")] ?? path;
  }
  if (scope === "choices") return labels.choices ?? path;
  return labels[path] ?? path;
}
/**
 * Question全体を日英・Choice・公開状態とともに管理します。
 * @param root0
 * @param root0.initialQuestion
 * @param root0.databaseConfigured
 * @param root0.locale
 * @param root0.relatedGuides
 * @returns {JSX.Element} Quiz編集フォーム。
 */
export function AdminQuizEditor({ initialQuestion, databaseConfigured, locale, relatedGuides }: Props) {
  const router = useRouter();
  const t = getTranslation(locale).admin;
  const q = t.quiz;
  const [questionId, setQuestionId] = useState<string | null>(initialQuestion?.id ?? null);
  const [values, setValues] = useState(() => toValues(initialQuestion));
  const [savedSnapshot, setSavedSnapshot] = useState(() => serialize(toValues(initialQuestion)));
  const [status, setStatus] = useState<"draft" | "published">(initialQuestion?.isPublished ? "published" : "draft");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverMissingFields, setServerMissingFields] = useState<string[]>([]);
  const isDirty = savedSnapshot !== serialize(values);
  const busy = saving || publishing;
  const missingFields = useMemo(() => getQuizPublicationMissingFields(values), [values]);
  useUnsavedChangesWarning({ isDirty, message: t.unsavedChanges });
  function setRoot(key: "category" | "sourceUrl" | "relatedContentId" | "correctChoiceId", value: string | null) {
    setValues((current) => ({ ...current, [key]: value }));
    clearError(key);
  }
  function setTranslation(language: "ja" | "en", key: "question" | "explanation" | "sourceLabel", value: string) {
    setValues((current) => ({
      ...current,
      translations: { ...current.translations, [language]: { ...current.translations[language], [key]: value } },
    }));
    clearError("translations." + language + "." + key);
  }
  function setSpecialDatePart(key: "month" | "day", value: string) {
    const number = value ? Number(value) : null;
    setValues((current) => ({
      ...current,
      specialDate:
        number === null
          ? null
          : {
              ...(current.specialDate ?? { month: 1, day: 1 }),
              [key]: number,
              ...(key === "month" ? { day: Math.min(current.specialDate?.day ?? 1, getDaysInMonth(number)) } : {}),
            },
    }));
    clearError("specialDate");
  }
  function updateChoice(index: number, key: "id" | "ja" | "en", value: string) {
    setValues((current) => ({
      ...current,
      choices: current.choices.map((choice, choiceIndex) =>
        choiceIndex !== index
          ? choice
          : key === "id"
            ? { ...choice, id: value }
            : { ...choice, translations: { ...choice.translations, [key]: value } },
      ),
    }));
    clearError("choices." + index + "." + key);
  }
  function addChoice() {
    if (values.choices.length >= 4) return;
    setValues((current) => ({
      ...current,
      choices: [
        ...current.choices,
        {
          id: getNextChoiceId(current.choices),
          sortOrder: current.choices.length,
          translations: { ja: "", en: "" },
        },
      ],
    }));
  }
  function removeChoice(index: number) {
    const removed = values.choices[index];
    if (!removed || removed.id === values.correctChoiceId) return;
    setValues((current) => ({
      ...current,
      choices: current.choices
        .filter((_, choiceIndex) => choiceIndex !== index)
        .map((choice, sortOrder) => ({ ...choice, sortOrder })),
    }));
  }
  function moveChoice(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= values.choices.length) return;
    setValues((current) => {
      const choices = [...current.choices];
      [choices[index], choices[target]] = [choices[target], choices[index]];
      return { ...current, choices: choices.map((choice, sortOrder) => ({ ...choice, sortOrder })) };
    });
  }
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
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !databaseConfigured) return;
    resetFeedback();
    setSaving(true);
    try {
      const response = await fetch(questionId ? "/api/admin/quiz/" + questionId : "/api/admin/quiz", {
        method: questionId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(values)),
      });
      const body = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !body.question) {
        setFieldErrors(asFieldErrors(body.fieldErrors));
        setServerMissingFields(toMissingFields(body.missingFields));
        setError(getAdminQuizApiErrorMessage(locale, body));
        return;
      }
      const nextValues = toValues(body.question);
      const created = questionId === null;
      setQuestionId(body.question.id);
      setValues(nextValues);
      setSavedSnapshot(serialize(nextValues));
      setStatus(body.question.isPublished ? "published" : "draft");
      setMessage(body.question.isPublished ? q.publishedSaved : q.draftSaved);
      if (created) router.push("/admin/quiz/" + body.question.id);
      router.refresh();
    } catch {
      setError(getAdminQuizApiErrorMessage(locale, null));
    } finally {
      setSaving(false);
    }
  }
  async function changePublication(nextPublished: boolean) {
    if (!questionId || busy || !databaseConfigured || (nextPublished && isDirty)) return;
    const title = values.translations.ja.question || questionId || "";
    const confirmation = formatMessage(nextPublished ? q.confirmPublish : q.confirmDraft, { title });
    if (!window.confirm(confirmation)) return;
    resetFeedback();
    setPublishing(true);
    try {
      const response = await fetch("/api/admin/quiz/" + questionId + "/publication", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: nextPublished }),
      });
      const body = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !body.publication) {
        setServerMissingFields(toMissingFields(body.missingFields));
        setError(getAdminQuizApiErrorMessage(locale, body));
        return;
      }
      setStatus(body.publication.isPublished ? "published" : "draft");
      setMessage(body.publication.isPublished ? q.publishedSuccess : q.returnedToDraft);
      router.refresh();
    } catch {
      setError(getAdminQuizApiErrorMessage(locale, null));
    } finally {
      setPublishing(false);
    }
  }
  const publishBlocked = !questionId || isDirty || missingFields.length > 0 || busy || !databaseConfigured;
  return (
    <section className="admin-panel admin-wide admin-quiz-editor">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Irish Quiz</p>
          <h1>{questionId ? q.editHeading : q.addHeading}</h1>
          <p>{questionId ? q.editDescription : q.addDescription}</p>
        </div>
        <span className={"admin-publication-badge " + (status === "published" ? "is-published" : "is-unpublished")}>
          {status === "published" ? q.statusPublished : q.statusDraft}
        </span>
      </div>
      {!databaseConfigured ? <p className="admin-error">{q.databaseUnavailable}</p> : null}
      {Object.keys(fieldErrors).length > 0 ? (
        <p role="alert" className="admin-field-error">
          {formatMessage(q.fieldError, {
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
          {formatMessage(q.missingFields, {
            fields: serverMissingFields.map((field) => fieldLabel(field, q.publicationFields)).join(", "),
          })}
        </p>
      ) : null}
      <form className="admin-form admin-editor-form admin-quiz-form" onSubmit={save} aria-busy={busy}>
        <fieldset disabled={busy || !databaseConfigured}>
          <div className="admin-editor-grid">
            <label>
              {q.category}
              <select
                value={values.category ?? ""}
                onChange={(event) => setRoot("category", event.target.value || null)}
              >
                <option value="">{t.notRegistered}</option>
                {QUIZ_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {q.categories[category]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {q.relatedGuide}
              <select
                value={values.relatedContentId ?? ""}
                onChange={(event) => setRoot("relatedContentId", event.target.value || null)}
              >
                <option value="">{q.noRelatedGuide}</option>
                {relatedGuides.map((guide) => (
                  <option key={guide.id} value={guide.id}>
                    [{guide.status === "published" ? q.statusPublished : q.statusDraft}]{" "}
                    {guide.titleJa || guide.slug || guide.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-editor-grid">
            <label>
              {q.specialDate}
              <select
                value={values.specialDate?.month ?? ""}
                onChange={(event) => setSpecialDatePart("month", event.target.value)}
              >
                <option value="">{q.noSpecialDate}</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {q.specialDate}
              <select
                value={values.specialDate?.day ?? ""}
                disabled={!values.specialDate}
                onChange={(event) => setSpecialDatePart("day", event.target.value)}
              >
                <option value="">{q.noSpecialDate}</option>
                {Array.from(
                  { length: values.specialDate ? getDaysInMonth(values.specialDate.month) : 31 },
                  (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        </fieldset>
        {(["ja", "en"] as const).map((language) => (
          <fieldset key={language} disabled={busy || !databaseConfigured}>
            <legend>{language === "ja" ? t.japanese : t.english}</legend>
            <label>
              {q.question}
              <textarea
                rows={3}
                value={values.translations[language].question}
                onChange={(event) => setTranslation(language, "question", event.target.value)}
              />
            </label>
            <label>
              {q.explanation}
              <textarea
                rows={5}
                value={values.translations[language].explanation}
                onChange={(event) => setTranslation(language, "explanation", event.target.value)}
              />
            </label>
            <label>
              {q.sourceLabel}
              <input
                value={values.translations[language].sourceLabel}
                onChange={(event) => setTranslation(language, "sourceLabel", event.target.value)}
              />
            </label>
          </fieldset>
        ))}
        <fieldset disabled={busy || !databaseConfigured}>
          <legend>{q.choices}</legend>
          {values.choices.map((choice, index) => (
            <div className="admin-quiz-choice" key={choice.id + index}>
              <strong>{index + 1}</strong>
              <label>
                {q.choiceId}
                <input
                  value={choice.id}
                  maxLength={QUIZ_CHOICE_ID_MAX_LENGTH}
                  onChange={(event) => updateChoice(index, "id", event.target.value)}
                />
              </label>
              <label>
                {q.choiceLabel}（{t.japanese}）
                <input
                  value={choice.translations.ja}
                  onChange={(event) => updateChoice(index, "ja", event.target.value)}
                />
              </label>
              <label>
                {q.choiceLabel}（{t.english}）
                <input
                  value={choice.translations.en}
                  onChange={(event) => updateChoice(index, "en", event.target.value)}
                />
              </label>
              <button
                type="button"
                className="admin-secondary-action"
                onClick={() => moveChoice(index, -1)}
                disabled={index === 0}
              >
                {q.moveUp}
              </button>
              <button
                type="button"
                className="admin-secondary-action"
                onClick={() => moveChoice(index, 1)}
                disabled={index === values.choices.length - 1}
              >
                {q.moveDown}
              </button>
              <button
                type="button"
                className="admin-secondary-action"
                onClick={() => removeChoice(index)}
                disabled={choice.id === values.correctChoiceId}
              >
                {q.removeChoice}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="admin-secondary-action"
            onClick={addChoice}
            disabled={values.choices.length >= 4}
          >
            {q.addChoice}
          </button>
        </fieldset>
        <fieldset disabled={busy || !databaseConfigured}>
          <legend>{q.correctAnswer}</legend>
          <select
            value={values.correctChoiceId ?? ""}
            onChange={(event) => setRoot("correctChoiceId", event.target.value || null)}
          >
            <option value="">{t.notRegistered}</option>
            {values.choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.id}
              </option>
            ))}
          </select>
        </fieldset>
        <fieldset disabled={busy || !databaseConfigured}>
          <legend>{q.sourceUrl}</legend>
          <label>
            {q.sourceUrl}
            <input
              type="url"
              inputMode="url"
              value={values.sourceUrl ?? ""}
              onChange={(event) => setRoot("sourceUrl", event.target.value || null)}
            />
          </label>
        </fieldset>
        <div className="admin-content-save-row">
          <button type="submit" disabled={busy || !databaseConfigured}>
            {saving ? t.saving : status === "published" ? q.savePublished : q.saveDraft}
          </button>
          <Link className="admin-secondary-action" href="/admin/quiz">
            {t.cancel}
          </Link>
          {isDirty ? <span className="admin-content-unsaved">{t.unsavedChanges}</span> : null}
        </div>
      </form>
      <section className="admin-content-publication" aria-labelledby="admin-quiz-publication-heading">
        <div>
          <h2 id="admin-quiz-publication-heading">{q.publicationHeading}</h2>
          <p>
            {missingFields.length === 0
              ? q.readyToPublish
              : formatMessage(q.missingFields, {
                  fields: missingFields.map((field) => fieldLabel(field, q.publicationFields)).join(", "),
                })}
          </p>
          {isDirty && questionId ? <p className="admin-content-unsaved">{q.saveBeforePublish}</p> : null}
        </div>
        {status === "published" ? (
          <button
            type="button"
            className="admin-secondary-action"
            disabled={busy || !databaseConfigured}
            onClick={() => void changePublication(false)}
          >
            {publishing ? q.changingStatus : q.returnToDraft}
          </button>
        ) : (
          <button type="button" disabled={publishBlocked} onClick={() => void changePublication(true)}>
            {publishing ? q.changingStatus : q.publish}
          </button>
        )}
      </section>
    </section>
  );
}
function getDaysInMonth(month: number) {
  return new Date(Date.UTC(2000, month, 0)).getUTCDate();
}
function getNextChoiceId(choices: readonly { id: string }[]) {
  const ids = new Set(choices.map((choice) => choice.id));
  let number = 1;
  while (ids.has("choice-" + number)) number += 1;
  return "choice-" + number;
}
