import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { getTranslation } from "./lib/i18n";
import { getRequestLocale } from "./lib/i18n/server";

/**
 * リクエストの選択言語に対応するページメタデータを生成します。
 * @returns {Promise<Metadata>} 言語別のtitleとdescription。
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslation(await getRequestLocale()).metadata;

  return {
    title: t.title,
    description: t.description,
    icons: {
      icon: "/icon.svg",
      shortcut: "/icon.svg",
      apple: "/icon.svg",
    },
  };
}

/**
 * 日本語ページ全体のメタデータと共通HTML構造を定義します。
 * @param {{ children: React.ReactNode }} root0 - 共通レイアウトの子要素。
 * @param {React.ReactNode} root0.children - ページ本文。
 * @returns {JSX.Element} 共通HTMLレイアウト。
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale}>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
