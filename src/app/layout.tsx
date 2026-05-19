import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "辦公室小物管理系統",
  description: "可愛的辦公室用具管理小幫手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className={`bg-sky-50/50 text-gray-800 font-handwriting`}>{children}</body>
    </html>
  );
}
