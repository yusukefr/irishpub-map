import { createHmac, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export const ADMIN_SESSION_COOKIE = "irishpub-map-admin-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type SessionPayload = {
  expiresAt: number;
  username: string;
};

/** 管理画面の認証に必要な環境変数がすべて設定されているかを返します。 */
export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_SESSION_SECRET);
}

/** 入力された認証情報を、環境変数に設定された管理者情報と定数時間で照合します。 */
export async function verifyAdminCredentials(username: string, password: string) {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedUsername || !passwordHash || !safeEqual(username, expectedUsername)) return false;

  const [salt, expectedHash] = passwordHash.split(":");
  if (!salt || !expectedHash) return false;

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return safeEqual(Buffer.from(expectedHash, "base64"), derivedKey);
}

/** ユーザー名と有効期限を署名した、サーバー検証可能なセッショントークンを生成します。 */
export function createAdminSession(username: string) {
  const payload: SessionPayload = { expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000, username };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, getSessionSecret())}`;
}

/** Cookieヘッダーから管理者セッションを読み取り、署名と有効期限を検証します。 */
export function getAdminSession(cookieHeader: string | null) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const token = readCookie(cookieHeader, ADMIN_SESSION_COOKIE);
  if (!secret || !token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload, secret))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    return typeof payload.username === "string" && payload.expiresAt > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/** 署名済みセッションをブラウザへ保存するためのCookie文字列を返します。 */
export function sessionCookie(session: string) {
  return `${ADMIN_SESSION_COOKIE}=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}; Secure`;
}

/** 管理者セッションを即時失効させるCookie文字列を返します。 */
export function expiredSessionCookie() {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
}

function getSessionSecret() {
  if (!process.env.ADMIN_SESSION_SECRET) throw new Error("Admin authentication is not configured.");
  return process.env.ADMIN_SESSION_SECRET;
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function readCookie(cookieHeader: string | null, name: string) {
  return cookieHeader
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

// 長さが異なる場合も先に判定し、timingSafeEqualへ不正な長さを渡さないようにします。
function safeEqual(left: string | Buffer, right: string | Buffer) {
  const leftBuffer = Buffer.isBuffer(left) ? left : Buffer.from(left);
  const rightBuffer = Buffer.isBuffer(right) ? right : Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
