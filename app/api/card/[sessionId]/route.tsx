import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { shareCardQr } from "@/lib/card-qr";
import { personaById, personas } from "@/lib/content";
import { db } from "@/lib/db";
import type { Persona } from "@/lib/types";

export const runtime = "nodejs";

// 分享卡规格:1080×1440 竖版 3:4
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

/** 由 sessionId 派生一个稳定的四位收藏编号(仅作卡面收藏感,非人数统计) */
function cardSerial(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return String(1000 + (h % 9000));
}

/** CSS 绘制的猫爪印(纯形状,无 emoji/外链),作卡面装饰分隔 */
function PawMark({ color }: { color: string }) {
  const toe = (raised: number) => ({
    display: "flex",
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: color,
    marginBottom: raised,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div style={toe(2)} />
        <div style={toe(12)} />
        <div style={toe(12)} />
        <div style={toe(2)} />
      </div>
      <div
        style={{
          display: "flex",
          width: 78,
          height: 58,
          borderRadius: 999,
          backgroundColor: color,
          marginTop: 6,
        }}
      />
    </div>
  );
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
  const serial = cardSerial(sessionId);
  const qr = await shareCardQr({ dark: "#3E3226", light: "#FFFFFF" });

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
          backgroundImage: `radial-gradient(62% 34% at 50% 0%, ${accent}22, transparent 70%), radial-gradient(98% 52% at 50% 112%, ${accent}14, transparent 62%)`,
          padding: "78px 66px",
          fontFamily: "CardFont",
          color: "#3E3226",
          position: "relative",
        }}
      >
        {/* 内边框装饰 */}
        <div
          style={{
            position: "absolute",
            top: 36,
            left: 36,
            right: 36,
            bottom: 36,
            border: `3px solid ${accent}`,
            opacity: 0.32,
            borderRadius: 30,
          }}
        />

        {/* 顶部:品牌名 + 收藏编号 */}
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 10, color: accent }}>
            本命猫鉴定所
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              letterSpacing: 3,
              color: accent,
              border: `2px solid ${accent}`,
              borderRadius: 999,
              padding: "6px 18px",
              opacity: 0.85,
            }}
          >
            No.{serial}
          </div>
        </div>

        {/* 中部:称号 + 猫爪 + 品种 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
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
          <div style={{ display: "flex", fontSize: 126, letterSpacing: 10 }}>{persona.title}</div>
          <PawMark color={accent} />
          <div style={{ display: "flex", fontSize: 32, color: "#8A7B68", letterSpacing: 6 }}>
            你的本命猫
          </div>
          <div style={{ display: "flex", fontSize: 74, color: accent, letterSpacing: 4 }}>
            {persona.primaryBreed.name}
          </div>
        </div>

        {/* 判词:柔和面板,提高对比与截图质感 */}
        <div
          style={{
            display: "flex",
            maxWidth: 904,
            padding: "34px 44px",
            borderRadius: 28,
            backgroundColor: "rgba(255,255,255,0.55)",
            border: "2px solid rgba(255,255,255,0.72)",
            fontSize: 46,
            lineHeight: 1.7,
            textAlign: "center",
            color: "#3E3226",
          }}
        >
          {`「${persona.verdict}」`}
        </div>

        {/* 底部:引流文案 + 短链(左) + 二维码(右);未配置站点地址时保持居中布局 */}
        {qr ? (
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", fontSize: 34, letterSpacing: 5, color: "#5C5142" }}>
                测测你内心住着哪只猫
              </div>
              <div style={{ display: "flex", fontSize: 28, color: "#8A7B68", letterSpacing: 2 }}>
                {siteShortLink()}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                border: `2px solid ${accent}44`,
                padding: "12px 12px 8px",
              }}
            >
              <img src={qr} width={132} height={132} style={{ borderRadius: 4 }} />
              <div style={{ display: "flex", marginTop: 6, fontSize: 18, color: "#8A7B68", letterSpacing: 4 }}>
                扫码直达
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 34, letterSpacing: 5, color: "#5C5142" }}>
              测测你内心住着哪只猫
            </div>
            <div style={{ display: "flex", fontSize: 28, color: "#8A7B68", letterSpacing: 2 }}>
              {siteShortLink()}
            </div>
          </div>
        )}
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
