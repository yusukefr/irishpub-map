import Link from "next/link";
import type { ComponentPropsWithRef } from "react";
import { Button, IconButton } from "./button";
import styles from "./ui.module.css";

/**
 * 公開ヘッダーのブランド領域をリンクとして共有します。
 * @param {ComponentPropsWithRef<typeof Link>} props - ホームへのリンクとブランド表示。
 * @returns ブランドリンク。
 */
export function BrandLink({ className = "", ...props }: ComponentPropsWithRef<typeof Link>) {
  return <Link {...props} className={`${styles.brand} ${className}`} />;
}

/**
 * 現在地を下線とaria-currentで示すヘッダーナビゲーションです。
 * @param {ComponentPropsWithRef<typeof Link>} props - リンク先と現在のページかどうか。
 * @returns ナビゲーションリンク。
 */
export function NavigationLink({
  current = false,
  className = "",
  ...props
}: ComponentPropsWithRef<typeof Link> & { current?: boolean }) {
  return <Link {...props} aria-current={current ? "page" : undefined} className={`${styles.navLink} ${className}`} />;
}

/**
 * LanguageSwitcherなどの既存メニュー操作へヘッダー用surfaceを適用します。
 * @param {ComponentPropsWithRef<typeof Button>} props - メニューのラベルと既存の操作・ref設定。
 * @returns ヘッダー操作ボタン。
 */
export function HeaderAction({ className = "", ...props }: Omit<ComponentPropsWithRef<typeof Button>, "variant">) {
  return <Button {...props} variant="ghost" className={`${styles.headerAction} ${className}`} />;
}

/**
 * メニューなどのアイコン操作に必須ラベルとヘッダー用surfaceを適用します。
 * @param {ComponentPropsWithRef<typeof IconButton>} props - アイコン、必須ラベル、操作設定。
 * @returns ヘッダー用アイコンボタン。
 */
export function HeaderIconButton({
  className = "",
  ...props
}: Omit<ComponentPropsWithRef<typeof IconButton>, "variant">) {
  return <IconButton {...props} variant="ghost" className={`${styles.headerAction} ${className}`} />;
}
