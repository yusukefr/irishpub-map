"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  ADMIN_STATUS_NAME_MAX_LENGTH,
  type AdminPubStatus,
  type AdminStatusFieldErrors,
} from "@irishpub-map/shared/admin-status";
import { getAdminStatusApiErrorMessage } from "../lib/admin-api-client";
import { formatMessage, getTranslation, type Locale } from "../lib/i18n";
import { useUnsavedChangesWarning } from "../lib/use-unsaved-changes-warning";
import { AdminPageHeader } from "./admin-page-header";

type Props = { initialStatuses: AdminPubStatus[]; databaseConfigured: boolean; locale: Locale };
type ApiResponse = { status?: AdminPubStatus; errorCode?: unknown; fieldErrors?: AdminStatusFieldErrors };

/**
 * 固定keyを維持しながら営業ステータスの日英表示名を編集します。
 * @param {Props} props - 初期ステータス、DB設定状態、表示ロケール。
 * @returns {JSX.Element} 営業ステータス一覧と表示名編集フォーム。
 */
export function AdminStatusManager({ initialStatuses, databaseConfigured, locale }: Props) {
  const t = getTranslation(locale).admin;
  const [statuses, setStatuses] = useState(initialStatuses);
  const [editing, setEditing] = useState<AdminPubStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AdminStatusFieldErrors>({});
  const [formDirty, setFormDirty] = useState(false);

  useUnsavedChangesWarning({ isDirty: formDirty, message: t.unsavedChanges });

  function resetFeedback() {
    setMessage("");
    setError("");
    setFieldErrors({});
  }

  function fieldErrorMessage(field: keyof AdminStatusFieldErrors) {
    const code = fieldErrors[field];
    return code ? getAdminStatusApiErrorMessage(locale, { fieldErrors: { [field]: code } }) : "";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !editing) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    resetFeedback();
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/statuses/${editing.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameJa: data.get("nameJa"), nameEn: data.get("nameEn") }),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !result.status) {
        setFieldErrors(asStatusFieldErrors(result.fieldErrors));
        setError(getAdminStatusApiErrorMessage(locale, result));
        return;
      }
      const savedStatus = result.status;
      setStatuses((current) => current.map((status) => (status.code === savedStatus.code ? savedStatus : status)));
      setEditing(savedStatus);
      setFormDirty(false);
      setMessage(t.statusSaved);
    } catch {
      setError(getAdminStatusApiErrorMessage(locale, null));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-statuses-page">
      <AdminPageHeader sectionLabel="Master data" title={t.statusesHeading} description={t.statusesDescription} />
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

      {editing ? (
        <form
          className="admin-form admin-status-form"
          onSubmit={save}
          onChange={() => {
            setFormDirty(true);
            setFieldErrors({});
          }}
          key={`${editing.code}:${editing.nameJa}:${editing.nameEn ?? ""}`}
          aria-busy={saving}
        >
          <h2>{t.editStatus}</h2>
          <fieldset disabled={saving || !databaseConfigured}>
            <label>
              {t.statusKey}
              <input value={editing.key} readOnly aria-describedby="status-key-description" />
              <span id="status-key-description">{t.statusKeyDescription}</span>
            </label>
            <label>
              {t.statusNameJa}
              <input
                id="admin-status-name-ja"
                name="nameJa"
                required
                maxLength={ADMIN_STATUS_NAME_MAX_LENGTH}
                defaultValue={editing.nameJa}
                aria-invalid={Boolean(fieldErrors.nameJa)}
                aria-describedby={fieldErrors.nameJa ? "admin-status-name-ja-error" : undefined}
              />
              {fieldErrors.nameJa ? (
                <span id="admin-status-name-ja-error" className="admin-field-error">
                  {fieldErrorMessage("nameJa")}
                </span>
              ) : null}
            </label>
            <label>
              {t.statusNameEn}
              <input
                id="admin-status-name-en"
                name="nameEn"
                maxLength={ADMIN_STATUS_NAME_MAX_LENGTH}
                defaultValue={editing.nameEn ?? ""}
                aria-invalid={Boolean(fieldErrors.nameEn)}
                aria-describedby={fieldErrors.nameEn ? "admin-status-name-en-error" : undefined}
              />
              {fieldErrors.nameEn ? (
                <span id="admin-status-name-en-error" className="admin-field-error">
                  {fieldErrorMessage("nameEn")}
                </span>
              ) : null}
            </label>
            <div className="admin-actions">
              <button type="submit">{saving ? t.saving : t.update}</button>
              <button
                type="button"
                className="admin-secondary-action"
                onClick={() => {
                  if (formDirty && !window.confirm(t.unsavedChanges)) return;
                  setEditing(null);
                  setFormDirty(false);
                  resetFeedback();
                }}
              >
                {t.cancel}
              </button>
            </div>
          </fieldset>
        </form>
      ) : null}

      <section className="admin-status-section" aria-labelledby="admin-status-list-heading">
        <h2 id="admin-status-list-heading">{formatMessage(t.listedStatuses, { count: statuses.length })}</h2>
        {statuses.length === 0 ? <p>{t.noStatuses}</p> : null}
        {statuses.length > 0 ? (
          <div className="admin-pub-table-wrap admin-master-table-wrap">
            <table className="admin-pub-table admin-master-table">
              <thead>
                <tr>
                  <th scope="col">{t.statusKey}</th>
                  <th scope="col">{t.statusNameJa}</th>
                  <th scope="col">{t.statusNameEn}</th>
                  <th scope="col">{t.operations}</th>
                </tr>
              </thead>
              <tbody>
                {statuses.map((status) => (
                  <tr key={status.code}>
                    <th scope="row" data-label={t.statusKey}>
                      <code>{status.key}</code>
                    </th>
                    <td data-label={t.statusNameJa}>{status.nameJa}</td>
                    <td data-label={t.statusNameEn}>{status.nameEn || t.notRegistered}</td>
                    <td data-label={t.operations}>
                      <div className="admin-status-actions">
                        <button
                          type="button"
                          onClick={() => {
                            if (formDirty && !window.confirm(t.unsavedChanges)) return;
                            setEditing(status);
                            setFormDirty(false);
                            resetFeedback();
                          }}
                          disabled={saving || !databaseConfigured}
                        >
                          {t.edit}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function asStatusFieldErrors(value: unknown): AdminStatusFieldErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, code]) => typeof code === "string"),
  ) as AdminStatusFieldErrors;
}
