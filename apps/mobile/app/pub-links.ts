import { Linking } from "react-native";

/** 外部公開されたHTTP(S) URLだけを許可し、OSが扱えないURLは失敗として返します。 */
export function isSafeExternalUrl(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;

  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname) && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

/** 許可したURLをユーザー操作からのみ開き、端末側の失敗を呼出元へ安全に返します。 */
export async function openExternalUrl(value: string): Promise<boolean> {
  if (!isSafeExternalUrl(value)) return false;

  try {
    const canOpen = await Linking.canOpenURL(value);
    if (!canOpen) return false;
    await Linking.openURL(value);
    return true;
  } catch {
    return false;
  }
}
