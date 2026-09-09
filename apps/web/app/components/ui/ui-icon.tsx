import styles from "./ui.module.css";

// App Routerのメタデータ予約名icon.tsxを避け、通常のUI部品として扱います。

/** 共通操作で使う装飾アイコンです。 */
export type IconName = "search" | "close" | "location" | "plus" | "minus" | "menu" | "check";
const paths: Record<IconName, string> = {
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  close: "M6 6l12 12M6 18L18 6",
  location: "M12 2v3m0 14v3M2 12h3m14 0h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  menu: "M4 6h16M4 12h16M4 18h16",
  check: "M4 12l5 5L20 6",
};

/**
 * 意味は親のラベルへ委ね、SVG自体は読み上げ対象から外します。
 * @param props - 操作を示すアイコン名。
 * @param props.name - 共通アイコンの識別子。
 * @returns 統一したstrokeと寸法のSVG。
 */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
