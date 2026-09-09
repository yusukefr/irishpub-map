import type { ComponentPropsWithRef } from "react";
import { IconButton } from "./button";
import styles from "./ui.module.css";

/**
 * Map上のアイコン操作を44px以上の明るいsurfaceへまとめます。
 * @param {ComponentPropsWithRef<typeof IconButton>} props - 必須の操作ラベル、アイコン、クリック設定。
 * @returns 地図操作ボタン。
 */
export function MapControl({ className = "", ...props }: Omit<ComponentPropsWithRef<typeof IconButton>, "variant">) {
  return <IconButton {...props} variant="secondary" className={`${styles.mapControl} ${className}`} />;
}
