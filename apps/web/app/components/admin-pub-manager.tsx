"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { Pub, PubStatus } from "@irishpub-map/shared/pub";

type Props = { initialPubs: Pub[]; databaseConfigured: boolean };
const statuses: PubStatus[] = ["open", "temporarily_closed", "closed", "unknown"];
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
    tags: String(form.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
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
export function AdminPubManager({ initialPubs, databaseConfigured }: Props) {
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
    if (!response.ok || !body.pub) return setMessage(body.error || "保存に失敗しました。");
    setPubs((current) =>
      editing
        ? current.map((pub) => (pub.id === body.pub!.id ? body.pub! : pub))
        : [...current, body.pub!].toSorted((a, b) => a.name.localeCompare(b.name, "ja")),
    );
    setEditing(null);
    form.reset();
    setMessage("保存しました。");
  }

  async function remove(pub: Pub) {
    if (!window.confirm(`「${pub.name}」を削除しますか？`)) return;
    const response = await fetch(`/api/admin/pubs/${pub.id}`, { method: "DELETE" });
    if (!response.ok) return setMessage("削除に失敗しました。");
    setPubs((current) => current.filter((item) => item.id !== pub.id));
    setMessage("削除しました。");
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
            <h1>店舗管理</h1>
          </div>
          <button type="button" onClick={logout}>
            ログアウト
          </button>
        </div>
        {!databaseConfigured ? <p className="admin-error">DATABASE_URL が未設定です。閲覧のみ可能です。</p> : null}
        {message ? <p role="status">{message}</p> : null}
        <form className="admin-form admin-pub-form" onSubmit={save} key={editing?.id || "new"}>
          <h2>{editing ? "店舗を編集" : "店舗を追加"}</h2>
          <label>
            店舗名
            <input name="name" required defaultValue={values.name} />
          </label>
          <label>
            都道府県
            <input name="prefecture" required defaultValue={values.prefecture} />
          </label>
          <label>
            市区町村
            <input name="city" defaultValue={values.city} />
          </label>
          <label>
            住所
            <input name="address" required defaultValue={values.address} />
          </label>
          <label>
            緯度
            <input name="latitude" type="number" step="any" required defaultValue={values.latitude} />
          </label>
          <label>
            経度
            <input name="longitude" type="number" step="any" required defaultValue={values.longitude} />
          </label>
          <label>
            タグ（カンマ区切り）
            <input name="tags" defaultValue={values.tags} />
          </label>
          <label>
            営業状況
            <select name="status" defaultValue={values.status}>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            公式サイト
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
            <button disabled={!databaseConfigured}>{editing ? "更新" : "追加"}</button>
            {editing ? (
              <button type="button" onClick={() => setEditing(null)}>
                キャンセル
              </button>
            ) : null}
          </div>
        </form>
        <section>
          <h2>掲載店舗（{pubs.length}件）</h2>
          <ul className="admin-pub-list">
            {pubs.map((pub) => (
              <li key={pub.id}>
                <span>
                  <strong>{pub.name}</strong> {pub.prefecture} / {pub.address}
                </span>
                <span>
                  <button type="button" onClick={() => setEditing(pub)}>
                    編集
                  </button>
                  <button type="button" onClick={() => remove(pub)} disabled={!databaseConfigured}>
                    削除
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
