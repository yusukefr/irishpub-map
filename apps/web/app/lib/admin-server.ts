import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession, isAdminConfigured } from "./admin-auth";

/**
 * 保護対象の管理ページでセッションを検証し、未認証時はログイン画面へ遷移します。
 * @returns {Promise<void>} 有効な管理者セッションがある場合に完了します。
 */
export async function requireAdminSession() {
  const session = isAdminConfigured() ? getAdminSession((await cookies()).toString()) : null;
  if (!session) redirect("/admin/login");
}
