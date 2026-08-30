/**
 * 外部リンクに利用できるHTTP(S) URLだけを返します。
 * @param {string | null | undefined} value - 検証するURL。
 * @returns {string | null} 安全な絶対URL、または無効な値の場合はnull。
 */
export function getSafeExternalUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
