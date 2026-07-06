import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "日本の Irish Pub マップ",
  description: "日本国内の Irish Pub を地図から探せるサービス"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
