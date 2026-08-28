"use client";

import { useRouter } from "next/navigation";
import { getAdminApiErrorMessage } from "../lib/admin-api-client";
import { getTranslation, type Locale } from "../lib/i18n";
import { useState } from "react";
import type { FormEvent } from "react";

/**
 * 管理者ログインAPIを呼び出し、認証結果を画面へ反映するフォームです。
 * @returns {JSX.Element} 管理者ログインフォーム。
 */
type LoginFormProps = { locale: Locale };

/**
 * 管理者ログインAPIを呼び出し、認証結果を画面へ反映するフォームです。
 * @param {LoginFormProps} root0 - 表示言語。
 * @param {Locale} root0.locale - 表示言語。
 * @returns {JSX.Element} 管理者ログインフォーム。
 */
export function LoginForm({ locale }: LoginFormProps) {
  const t = getTranslation(locale);
  const [error, setError] = useState("");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      if (response.ok) {
        router.push("/admin");
        return;
      }
      setError(getAdminApiErrorMessage(locale, await response.json().catch(() => null)));
    } catch {
      setError(getAdminApiErrorMessage(locale, null));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        {t.admin.id}
        <input name="username" required autoComplete="username" />
      </label>
      <label>
        {t.admin.password}
        <input name="password" type="password" required autoComplete="current-password" />
      </label>
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
      <button disabled={submitting}>{submitting ? t.admin.loggingIn : t.admin.login}</button>
    </form>
  );
}
