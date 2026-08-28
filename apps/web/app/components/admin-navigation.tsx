"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getTranslation, type Locale } from "../lib/i18n";

/**
 * 管理機能間の導線と現在位置、ログアウト操作を共通提供します。
 * @param {{ locale: Locale }} root0 - 管理画面の表示設定。
 * @param {Locale} root0.locale - ナビゲーションに使用するロケール。
 * @returns {JSX.Element} 管理画面共通ナビゲーション。
 */
export function AdminNavigation({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = getTranslation(locale).admin;
  const items = [
    { href: "/admin/pubs", label: t.navPubs },
    { href: "/admin/tags", label: t.navTags },
    { href: "/admin/statuses", label: t.navStatuses },
  ];

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <nav aria-label={t.navigationLabel} className="admin-navigation">
      <ul>
        {items.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={logout}>
        {t.logout}
      </button>
    </nav>
  );
}
