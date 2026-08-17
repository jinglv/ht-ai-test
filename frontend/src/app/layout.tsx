import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";
import "@/styles/design-system.css";

export const metadata: Metadata = {
  title: "河图智弈 - 企业级 AI 测试管理平台",
  description: "AI 驱动的测试管理平台",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/logo.png", sizes: "any", type: "image/png" },
    ],
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      {/* 与 designs/*.html 一致地用 link 加载字体：Noto Serif SC 需要 Google 的
          unicode-range 分片才能覆盖中文字形，Material Symbols 则不在 next/font 清单内。
          eslint 的 no-page-custom-font 只针对 Pages Router，App Router 无 _document。 */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700;900&family=Noto+Sans+SC:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full flex flex-col">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
