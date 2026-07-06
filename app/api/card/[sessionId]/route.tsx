import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { personaById, personas } from "@/lib/content";
import { db } from "@/lib/db";
import type { Persona } from "@/lib/types";

export const runtime = "nodejs";

// 分享卡规格(任务书§6):1080×1440 竖版 3:4
const WIDTH = 1080;
const HEIGHT = 1440;

// 中文字体子集(npm run font:subset 生成),模块级缓存只读一次
let fontPromise: Promise<Buffer> | null = null;
function loadCardFont(): Promise<Buffer> {
  fontPromise ??= readFile(path.join(process.cwd(), "assets", "fonts", "card-font.ttf"));
  return fontPromise;
}

function siteShortLink(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "") || "benmingmao.app";
}

/** GET /api/card/[sessionId] — 生成免费分享卡 PNG;sessionId=demo 时出示例卡(用于 og:image) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  let persona: Persona | undefined;
  if (sessionId === "demo") {
    persona = personas[0];
  } else {
    const session = await db.getSession(sessionId);
    if (!session) return new Response("卡片不存在", { status: 404 });
    persona = personaById(session.personaId);
  }
  if (!persona) return new Response("人格数据缺失", { status: 500 });

  let font: Buffer;
  try {
    font = await loadCardFont();
  } catch {
    return new Response("字体文件缺失:请先运行 npm run font:subset", { status: 500 });
  }

  const { bg, accent } = persona.cardTheme;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: bg,
          padding: "96px 72px",
          fontFamily: "CardFont",
          color: "#3E3226",
          position: "relative",
        }}
      >
        {/* 内边框装饰 */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            right: 40,
            bottom: 40,
            border: `3px solid ${accent}`,
            opacity: 0.35,
            borderRadius: 28,
          }}
        />

        {/* 顶部品牌名 */}
        <div style={{ display: "flex", fontSize: 34, letterSpacing: 14, color: accent }}>
          本命猫鉴定所
        </div>

        {/* 中部:称号 + 品种 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 34,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 32,
              letterSpacing: 8,
              color: accent,
              border: `2px solid ${accent}`,
              borderRadius: 999,
              padding: "12px 34px",
            }}
          >
            {persona.subtitle}
          </div>
          <div style={{ display: "flex", fontSize: 124, letterSpacing: 10 }}>{persona.title}</div>
          <div style={{ display: "flex", width: 120, height: 5, backgroundColor: accent, borderRadius: 3 }} />
          <div style={{ display: "flex", fontSize: 32, color: "#8A7B68", letterSpacing: 6 }}>
            你的本命猫
          </div>
          <div style={{ display: "flex", fontSize: 72, color: accent, letterSpacing: 4 }}>
            {persona.primaryBreed.name}
          </div>
        </div>

        {/* 判词:卡面视觉重心 */}
        <div
          style={{
            display: "flex",
            maxWidth: 860,
            fontSize: 46,
            lineHeight: 1.75,
            textAlign: "center",
            color: "#4A3F33",
          }}
        >
          {`「${persona.verdict}」`}
        </div>

        {/* 底部:短链 + 引流文案 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", fontSize: 34, letterSpacing: 5, color: "#5C5142" }}>
            测测你内心住着哪只猫
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#8A7B68", letterSpacing: 2 }}>
            {siteShortLink()}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [{ name: "CardFont", data: font, style: "normal", weight: 400 }],
      headers: {
        // 同一会话的卡片内容不变,可长缓存
        "cache-control": "public, max-age=31536000, immutable",
        "content-disposition": 'inline; filename="benmingmao-card.png"',
      },
    },
  );
}
