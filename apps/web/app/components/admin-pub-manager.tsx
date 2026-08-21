"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { Pub } from "@irishpub-map/shared/pub";
import { PREFECTURES } from "@irishpub-map/shared/prefecture";
import { PUB_STATUS_DEFINITIONS } from "@irishpub-map/shared/status";
import { normalizeTags } from "@irishpub-map/shared/tag";
import { formatMessage, getTranslation, type Locale } from "../lib/i18n";

type Props = { initialPubs: Pub[]; databaseConfigured: boolean; locale: Locale };
const statuses = PUB_STATUS_DEFINITIONS;
const emptyPub = {
  name: "",
  prefecture: "",
  city: "",
  address: "",
  latitude: "",
  longitude: "",
  websiteUrl: "",
  googleMapsUrl: "",
  instagramUrl: "",
  tags: "",
  status: "open",
};

/** フォーム値をAPI入力形式へ変換し、未入力の任意項目を正規化します。 */
function toBody(form: FormData) {
  return {
    name: form.get("name"),
    prefecture: form.get("prefecture"),
    city: form.get("city") || undefined,
    address: form.get("address"),
    latitude: Number(form.get("latitude")),
    longitude: Number(form.get("longitude")),
    websiteUrl: form.get("websiteUrl") || null,
    googleMapsUrl: form.get("googleMapsUrl") || null,
    instagramUrl: form.get("instagramUrl") || null,
    tags: normalizeTags(String(form.get("tags") || "").split(",")),
    status: form.get("status"),
  };
}

/**
 * 管理者向けの店舗追加・編集・削除とローカル一覧状態を管理します。
 * @param {{ initialPubs: Pub[]; databaseConfigured: boolean }} root0 - 管理画面の初期状態。
 * @param {Pub[]} root0.initialPubs - 初期表示する店舗一覧。
 * @param {boolean} root0.databaseConfigured - DB永続化が利用可能かどうか。
 * @returns {JSX.Element} 店舗管理画面。
 */
export function AdminPubManager({ initialPubs, databaseConfigured, locale }: Props) {
  const t = getTranslation(locale);
  const [pubs, setPubs] = useState(initialPubs);
  const [editing, setEditing] = useState<Pub | null>(null);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const response = await fetch(editing ? `/api/admin/pubs/${editing.id}` : "/api/admin/pubs", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toBody(new FormData(form))),
    });
    const body = (await response.json()) as { pub?: Pub; error?: string };
    if (!response.ok || !body.pub) return setMessage(body.error || t.admin.saveFailed);
    setPubs((current) =>
      editing
        ? current.map((pub) => (pub.id === body.pub!.id ? body.pub! : pub))
        : [...current, body.pub!].toSorted((a, b) => a.name.localeCompare(b.name, "ja")),
    );
    setEditing(null);
    form.reset();
    setMessage(t.admin.saved);
  }

  async function remove(pub: Pub) {
    if (!window.confirm(formatMessage(t.admin.confirmDelete, { name: pub.name }))) return;
    const response = await fetch(`/api/admin/pubs/${pub.id}`, { method: "DELETE" });
    if (!response.ok) return setMessage(t.admin.deleteFailed);
    setPubs((current) => current.filter((item) => item.id !== pub.id));
    setMessage(t.admin.deleted);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const values = editing
    ? {
        ...editing,
        tags: editing.tags.join(", "),
        latitude: String(editing.latitude),
        longitude: String(editing.longitude),
        city: editing.city || "",
        websiteUrl: editing.websiteUrl || "",
        googleMapsUrl: editing.googleMapsUrl || "",
        instagramUrl: editing.instagramUrl || "",
      }
    : emptyPub;
  return (
    <main className="admin-shell">
      <section className="admin-panel admin-wide">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">Irish Pub Map</p>
            <h1>{t.admin.heading}</h1>
          </div>
          <button type="button" onClick={logout}>
            {t.admin.logout}
          </button>
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
            <select name="prefecture" required defaultValue={values.prefecture}>
              <option value="">{t.admin.selectPrefecture}</option>
              {PREFECTURES.map((prefecture) => (
                <option key={prefecture.code} value={prefecture.name}>
                  {prefecture.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.admin.city}
            <input name="city" defaultValue={values.city} />
          </label>
          <label>
            {t.admin.address}
            <input name="address" required defaultValue={values.address} />
          </label>
          <label>
            {t.admin.latitude}
            <input name="latitude" type="number" step="any" required defaultValue={values.latitude} />
          </label>
          <label>
            {t.admin.longitude}
            <input name="longitude" type="number" step="any" required defaultValue={values.longitude} />
          </label>
          <label>
            {t.admin.tags}
            <input name="tags" defaultValue={values.tags} />
          </label>
          <label>
            {t.admin.status}
            <select name="status" defaultValue={values.status}>
              {statuses.map((status) => (
                <option key={status.code} value={status.value}>
                  {t.list.statuses[status.value]}
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
              <button type="button" onClick={() => setEditing(null)}>
                {t.admin.cancel}
              </button>
            ) : null}
          </div>
        </form>
        <section>
          <h2>{formatMessage(t.admin.listedPubs, { count: pubs.length })}</h2>
          <ul className="admin-pub-list">
            {pubs.map((pub) => (
              <li key={pub.id}>
                <span>
                  <strong>{pub.name}</strong> {pub.prefecture} / {pub.address}
                </span>
                <span>
                  <button type="button" onClick={() => setEditing(pub)}>
                    {t.admin.edit}
                  </button>
                  <button type="button" onClick={() => remove(pub)} disabled={!databaseConfigured}>
                    {t.admin.delete}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}
