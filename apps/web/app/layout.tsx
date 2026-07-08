import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Irish Pub Map in Japan",
  description: "日本国内の Irish Pub を地図から探せるサービス",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
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
