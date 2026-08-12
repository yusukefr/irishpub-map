"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
    if (response.ok) router.push("/admin");
    else {
      const body = (await response.json().catch(() => ({ error: "ログインに失敗しました。" }))) as { error: string };
      setError(body.error);
      setSubmitting(false);
    }
  }

  return <form className="admin-form" onSubmit={submit}><label>ID<input name="username" required autoComplete="username" /></label><label>パスワード<input name="password" type="password" required autoComplete="current-password" /></label>{error ? <p className="admin-error" role="alert">{error}</p> : null}<button disabled={submitting}>{submitting ? "ログイン中…" : "ログイン"}</button></form>;
}
