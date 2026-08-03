import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "历史长河 · 时间填空与时间轴",
  description: "通过填空题记住历史事件的时间，答对的事件在时间轴上点亮完整信息。",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-geist-sans: "Geist", sans-serif;
            --font-geist-mono: "Geist Mono", monospace;
          }
        `}</style>
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
