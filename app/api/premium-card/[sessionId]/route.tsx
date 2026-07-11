import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { personaById } from "@/lib/content";
import { db } from "@/lib/db";
import { canAccessPremiumCard, premiumFlagLabel } from "@/lib/premium";
import type { Persona, PremiumFlags } from "@/lib/types";

export const runtime = "nodejs";

const WIDTH = 1080;
const HEIGHT = 1440;

let fontPromise: Promise<Buffer> | null = null;
function loadCardFont(): Promise<Buffer> {
  fontPromise ??= readFile(path.join(process.cwd(), "assets", "fonts", "card-font.ttf"));
  return fontPromise;
}

function siteShortLink(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "") || "benmingmao.app";
}

/** 由 sessionId 派生稳定的四位收藏编号(与免费卡一致,仅作收藏感) */
function cardSerial(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return String(1000 + (h % 9000));
}

function PawMark({ color }: { color: string }) {
  const toe = (raised: number) => ({
    display: "flex",
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: color,
    marginBottom: raised,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 7 }}>
        <div style={toe(1)} />
        <div style={toe(8)} />
        <div style={toe(8)} />
        <div style={toe(1)} />
      </div>
      <div
        style={{
          display: "flex",
          width: 54,
          height: 40,
          borderRadius: 999,
          backgroundColor: color,
          marginTop: 4,
        }}
      />
    </div>
  );
}

/** GET /api/premium-card/[sessionId] — 生成付费高级分享卡 PNG。 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const session = await db.getSession(sessionId);
  if (!session) return new Response("卡片不存在", { status: 404 });
  if (!canAccessPremiumCard(session)) return new Response("请先解锁并完成定制问题", { status: 403 });

  const persona = personaById(session.personaId);
  if (!persona) return new Response("人格数据缺失", { status: 500 });

  let font: Buffer;
  try {
    font = await loadCardFont();
  } catch {
    return new Response("字体文件缺失:请先运行 npm run font:subset", { status: 500 });
  }

  const flags = session.premiumFlags!;
  const highlights = buildHighlights(persona, flags);
  const accent = persona.cardTheme.accent;
  const serial = cardSerial(sessionId);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#FAF6EF",
          backgroundImage: `radial-gradient(60% 30% at 50% 0%, ${accent}1c, transparent 70%), radial-gradient(96% 48% at 50% 112%, ${accent}12, transparent 62%)`,
          padding: "70px 66px",
          fontFamily: "CardFont",
          color: "#3E3226",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 30,
            left: 30,
            right: 30,
            bottom: 30,
            border: `4px solid ${accent}`,
            borderRadius: 34,
            opacity: 0.22,
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 10, color: accent }}>
            本命猫深度报告
          </div>
          <div
            style={{
              display: "flex",
              border: `2px solid ${accent}`,
              borderRadius: 999,
              padding: "8px 24px",
              fontSize: 24,
              color: accent,
            }}
          >
            付费定制版
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 56,
          }}
        >
          <div style={{ display: "flex", fontSize: 36, color: "#8A7B68", letterSpacing: 8 }}>
            我的猫系人格
          </div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 96, letterSpacing: 8 }}>
            {persona.title}
          </div>
          <div style={{ display: "flex", marginTop: 24 }}>
            <PawMark color={accent} />
          </div>
          <div style={{ display: "flex", marginTop: 22, width: 132, height: 6, backgroundColor: accent, borderRadius: 6 }} />
          <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: "#8A7B68", letterSpacing: 6 }}>
            本命猫
          </div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 70, color: accent, letterSpacing: 4 }}>
            {persona.primaryBreed.name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 48,
          }}
        >
          {highlights.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                flexDirection: "column",
                borderRadius: 26,
                backgroundColor: "#FFFFFF",
                padding: "22px 30px",
                border: "2px solid rgba(62,50,38,0.08)",
                borderLeft: `8px solid ${accent}`,
              }}
            >
              <div style={{ display: "flex", fontSize: 24, color: accent, letterSpacing: 4 }}>
                {item.label}
              </div>
              <div style={{ display: "flex", marginTop: 10, fontSize: 34, lineHeight: 1.35, color: "#3E3226" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            // marginTop:auto 吸底;paddingTop 保证与面板区的最小间距,flexShrink:0 防止被挤压重叠
            marginTop: "auto",
            paddingTop: 18,
            flexShrink: 0,
            gap: 14,
          }}
        >
          <div style={{ display: "flex", fontSize: 42, color: accent }}>
            专属猫名: {highlights.catName}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#8A7B68", letterSpacing: 4 }}>
            No.{serial} · {siteShortLink()}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [{ name: "CardFont", data: font, style: "normal", weight: 400 }],
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-disposition": 'inline; filename="benmingmao-premium-card.png"',
      },
    },
  );
}

function buildHighlights(persona: Persona, flags: PremiumFlags) {
  const catName = catNameFor(flags.emotional_need);
  return Object.assign(
    [
      {
        label: "预算安全度",
        value: shortLabel("budget_safety", flags.budget_safety),
      },
      {
        label: "情绪陪伴关键词",
        value: shortLabel("emotional_need", flags.emotional_need),
      },
      {
        label: "养猫节奏建议",
        value: rhythmFor(flags),
      },
      {
        label: "主要风险提醒",
        value: shortLabel("main_worry", flags.main_worry),
      },
    ],
    { catName: `${catName} · ${persona.primaryBreed.name}` },
  );
}

function shortLabel(key: string, value?: string): string {
  return value ? premiumFlagLabel(key, value).replace(/^[^是]*是/, "") : "待补充";
}

function rhythmFor(flags: PremiumFlags): string {
  if (flags.final_focus === "preparation") return "先列清单,再确定接猫时间";
  if (flags.home_control === "shared" || flags.home_control === "negotiated") return "先确认居住许可,再安排接猫";
  if (flags.risk_tolerance === "low") return "先准备医疗备用金,再进入养猫";
  if (flags.emotional_need === "playfulness") return "选择互动强但可训练的节奏";
  return "稳定推进,把长期照顾排进生活";
}

function catNameFor(emotionalNeed?: string): string {
  if (emotionalNeed === "comfort") return "小棉";
  if (emotionalNeed === "routine") return "小钟";
  if (emotionalNeed === "playfulness") return "跳跳";
  if (emotionalNeed === "companionship") return "灯灯";
  return "小满";
}
