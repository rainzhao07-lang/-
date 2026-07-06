import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "本命猫鉴定所 — 测测你内心住着哪只猫",
    template: "%s · 本命猫鉴定所",
  },
  description:
    "AI宠物性格匹配:12道题测出你的铲屎官人格与本命猫品种。基础结果免费,深度养猫决策报告¥9.9,帮你避开冲动养猫的坑。",
  openGraph: {
    title: "本命猫鉴定所 — 测测你内心住着哪只猫",
    description: "你的人格猫,就是你该养的那只。AI帮你3分钟避开冲动养猫的坑。",
    type: "website",
    images: ["/api/card/demo"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAF6EF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-cream text-ink antialiased">{children}</body>
    </html>
  );
}
