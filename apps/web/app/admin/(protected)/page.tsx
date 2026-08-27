import { redirect } from "next/navigation";

/**
 * 管理画面の入口をパブ管理へ統一します。
 * @returns {never} `/admin/pubs` へのリダイレクト。
 */
export default function AdminIndexPage() {
  redirect("/admin/pubs");
}
