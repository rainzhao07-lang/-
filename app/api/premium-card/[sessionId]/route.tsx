import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { shareCardQr } from "@/lib/card-qr";
import { personaById } from "@/lib/content";
import { db } from "@/lib/db";
import { canAccessPremiumCard, premiumFlagLabel } from "@/lib/premium";
import type { Persona, PremiumFlags } from "@/lib/types";

export const runtime = "nodejs";

const WIDTH = 1080;
const HEIGHT = 1440;

// 付费卡专属配色:深可可底 + 香槟金,与免费卡的奶油底拉开档次
const INK = "#2A211A";
const GOLD = "#D8B77E";
const GOLD_DEEP = "#C9A25E";
const GOLD_LIGHT = "#EFDCB4";
const CREAM = "#F6EEDF";
const MUTED = "#C9B99F";

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

function PawMark({ color, size = 1 }: { color: string; size?: number }) {
  const toe = (raised: number) => ({
    display: "flex",
    width: 18 * size,
    height: 18 * size,
    borderRadius: 999,
    backgroundColor: color,
    marginBottom: raised * size,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 7 * size }}>
        <div style={toe(1)} />
        <div style={toe(8)} />
        <div style={toe(8)} />
        <div style={toe(1)} />
      </div>
      <div
        style={{
          display: "flex",
          width: 54 * size,
          height: 40 * size,
          borderRadius: 999,
          backgroundColor: color,
          marginTop: 4 * size,
        }}
      />
    </div>
  );
}

/** 证书感四角饰角:叠在外边框四角上的加粗金色短边 */
function CornerOrnament({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const arm = `4px solid ${GOLD}`;
  const style: Record<string, unknown> = {
    position: "absolute",
    display: "flex",
    width: 56,
    height: 56,
    opacity: 0.95,
  };
  if (corner === "tl") Object.assign(style, { top: 28, left: 28, borderTop: arm, borderLeft: arm, borderTopLeftRadius: 30 });
  if (corner === "tr") Object.assign(style, { top: 28, right: 28, borderTop: arm, borderRight: arm, borderTopRightRadius: 30 });
  if (corner === "bl") Object.assign(style, { bottom: 28, left: 28, borderBottom: arm, borderLeft: arm, borderBottomLeftRadius: 30 });
  if (corner === "br") Object.assign(style, { bottom: 28, right: 28, borderBottom: arm, borderRight: arm, borderBottomRightRadius: 30 });
  return <div style={style} />;
}

/** 金色菱形分隔线 */
function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", width: 116, height: 2, backgroundImage: `linear-gradient(90deg, transparent, ${GOLD})` }} />
      <div style={{ display: "flex", width: 12, height: 12, backgroundColor: GOLD, transform: "rotate(45deg)" }} />
      <div style={{ display: "flex", width: 116, height: 2, backgroundImage: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
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
  const qr = await shareCardQr({ dark: INK, light: "#FBF5EA" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: INK,
          backgroundImage: `radial-gradient(58% 30% at 50% 0%, rgba(216,183,126,0.16), transparent 70%), radial-gradient(90% 42% at 50% 110%, ${accent}30, transparent 65%)`,
          padding: "64px 60px",
          fontFamily: "CardFont",
          color: CREAM,
          position: "relative",
        }}
      >
        {/* 双层金色边框 + 四角饰角 */}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 28,
            right: 28,
            bottom: 28,
            border: "2px solid rgba(216,183,126,0.45)",
            borderRadius: 30,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 44,
            right: 44,
            bottom: 44,
            border: "1px solid rgba(216,183,126,0.20)",
            borderRadius: 20,
          }}
        />
        <CornerOrnament corner="tl" />
        <CornerOrnament corner="tr" />
        <CornerOrnament corner="bl" />
        <CornerOrnament corner="br" />

        {/* 背景爪印水印 */}
        <div style={{ position: "absolute", top: 218, right: 78, opacity: 0.07, transform: "rotate(24deg)", display: "flex" }}>
          <PawMark color={GOLD} size={2.4} />
        </div>
        <div style={{ position: "absolute", bottom: 470, left: 60, opacity: 0.06, transform: "rotate(-18deg)", display: "flex" }}>
          <PawMark color={GOLD} size={1.8} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 10, color: GOLD }}>
            本命猫深度报告
          </div>
          <div
            style={{
              display: "flex",
              borderRadius: 999,
              padding: "10px 26px",
              fontSize: 24,
              letterSpacing: 3,
              color: INK,
              backgroundImage: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DEEP})`,
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
            marginTop: 64,
          }}
        >
          <div style={{ display: "flex", fontSize: 30, color: MUTED, letterSpacing: 8 }}>
            我的猫系人格
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 96, letterSpacing: 8, color: CREAM }}>
            {persona.title}
          </div>
          <div style={{ display: "flex", marginTop: 32 }}>
            <Divider />
          </div>
          <div style={{ display: "flex", marginTop: 32, fontSize: 30, color: MUTED, letterSpacing: 6 }}>
            本命猫
          </div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 66, color: GOLD_LIGHT, letterSpacing: 4 }}>
            {persona.primaryBreed.name}
          </div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 18, letterSpacing: 8, color: "rgba(201,185,159,0.65)" }}>
            PREMIUM CUSTOM EDITION
          </div>
        </div>

        {/* 定制亮点:2×2 宫格 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 60 }}>
          {highlights.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                flexDirection: "column",
                width: 470,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(216,183,126,0.30)",
                padding: "30px 30px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", width: 8, height: 8, backgroundColor: GOLD, transform: "rotate(45deg)" }} />
                <div style={{ display: "flex", fontSize: 22, color: GOLD, letterSpacing: 4 }}>
                  {item.label}
                </div>
              </div>
              <div style={{ display: "flex", marginTop: 14, fontSize: 32, lineHeight: 1.5, color: CREAM }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* 底部:专属签名区(左) + 二维码(右) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "auto",
            paddingTop: 28,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", fontSize: 24, color: MUTED, letterSpacing: 4 }}>
              专属猫名
            </div>
            <div style={{ display: "flex", fontSize: 48, color: GOLD_LIGHT }}>
              {highlights.catName}
            </div>
            <div style={{ display: "flex", fontSize: 24, color: MUTED, letterSpacing: 2, marginTop: 6 }}>
              No.{serial} · 仅此一份
            </div>
            <div style={{ display: "flex", fontSize: 22, color: "rgba(201,185,159,0.75)", letterSpacing: 1 }}>
              {siteShortLink()}
            </div>
          </div>
          {qr ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "#FBF5EA",
                borderRadius: 18,
                border: "1px solid rgba(216,183,126,0.5)",
                padding: "16px 16px 12px",
              }}
            >
              <img src={qr} width={180} height={180} style={{ borderRadius: 6 }} />
              <div style={{ display: "flex", marginTop: 10, fontSize: 17, color: "#6B5B45", letterSpacing: 2 }}>
                扫码测测你的本命猫
              </div>
            </div>
          ) : null}
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
