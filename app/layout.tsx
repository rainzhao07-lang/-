import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "本命猫鉴定所 - 测测你内心住着哪只猫",
    template: "%s · 本命猫鉴定所",
  },
  description:
    "16道题测出你的铲屎官人格与本命猫适配方向。基础结果免费，深度养猫决策报告凭兑换码解锁。",
  openGraph: {
    title: "本命猫鉴定所 - 测测你内心住着哪只猫",
    description: "先看基础结果，再用兑换码解锁深度报告，帮你更冷静地判断自己适合怎样的猫。",
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
