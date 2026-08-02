import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "历史长河 · 进入时空",
  description: "沿中国朝代理解历史，把事件落入时间，并通过材料口述讲清前因、过程与影响。",
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
            --art-home: url("${basePath}/historical-art/home-history-river.webp");
            --art-timeline: url("${basePath}/historical-art/timeline-dynasties.webp");
            --art-placement: url("${basePath}/historical-art/time-placement.webp");
            --art-journeys: url("${basePath}/historical-art/journeys-silk-road.webp");
            --art-records: url("${basePath}/historical-art/records-scroll.webp");
            --art-event: url("${basePath}/historical-art/event-archive.webp");
          }
        `}</style>
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
