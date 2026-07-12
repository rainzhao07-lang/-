import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { adminSecretMatches, hasAdminSecret } from "@/lib/admin-auth";
import { db, type RedeemCodeRecord } from "@/lib/db";

export const runtime = "nodejs";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;
const MAX_BATCH = 1000;

type RequestBody = {
  count?: unknown;
  format?: unknown;
  channel?: unknown;
  batch?: unknown;
};

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}


function normalizeLabel(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

function redeemUrl(code: string) {
  const base = siteBaseUrl();
  return `${base || ""}/redeem?code=${encodeURIComponent(code)}`;
}

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function buildCsv(codes: string[], channel: string, batch: string) {
  const rows = [
    ["code", "redeem_url", "channel", "batch", "delivery_text"],
    ...codes.map((code) => [
      code,
      redeemUrl(code),
      channel,
      batch,
      `兑换码：${code}\n测试入口：${redeemUrl(code)}\n完成测试后点击“解锁报告”即可使用。`,
    ]),
  ];

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function deliveryText(code: string) {
  return `兑换码：${code}\n测试入口：${redeemUrl(code)}\n完成测试后点击“解锁报告”即可使用。`;
}

function buildBatchCsv(codes: RedeemCodeRecord[]) {
  const rows = [
    ["code", "redeem_url", "channel", "batch", "delivery_text", "used", "usedAt"],
    ...codes.map((item) => [
      item.code,
      redeemUrl(item.code),
      item.channel,
      item.batch,
      deliveryText(item.code),
      String(item.used),
      item.usedAt ?? "",
    ]),
  ];

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function safeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "batch";
}

function adminError(req: Request): NextResponse | null {
  if (!hasAdminSecret()) {
    return NextResponse.json({ error: "服务端未配置 ADMIN_SECRET" }, { status: 500 });
  }
  if (!adminSecretMatches(req.headers.get("x-admin-secret") ?? "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: Request) {
  const authError = adminError(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim().toUpperCase();
  const batch = url.searchParams.get("batch")?.trim();
  const format = url.searchParams.get("format");

  try {
    if (code) {
      const found = await db.getCode(code);
      return NextResponse.json(found
        ? { found: true, ...found }
        : {
            found: false,
            code,
            used: false,
            usedBySession: null,
            usedAt: null,
            channel: null,
            batch: null,
            createdAt: null,
          });
    }

    if (batch) {
      const codes = await db.listCodesByBatch(batch);
      if (format === "csv") {
        return new NextResponse(buildBatchCsv(codes), {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="benmingmao-codes-${safeFilenamePart(batch)}.csv"`,
          },
        });
      }
      return NextResponse.json(codes);
    }

    return NextResponse.json({ error: "必须提供 code 或 batch" }, { status: 400 });
  } catch (error) {
    console.error("[admin/codes] query failed:", error);
    return NextResponse.json({ error: "查询失败，请稍后重试" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const authError = adminError(req);
  if (authError) return authError;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) {
    return NextResponse.json({ error: `count 必须是 1-${MAX_BATCH} 的整数` }, { status: 400 });
  }

  const format = body.format === "csv" ? "csv" : "json";
  const channel = normalizeLabel(body.channel, "manual", 32);
  const batch = normalizeLabel(body.batch, new Date().toISOString().slice(0, 10), 64);

  const codes = new Set<string>();
  while (codes.size < count) codes.add(randomCode());
  const list = [...codes];

  await db.insertCodes(list, { channel, batch });

  if (format === "csv") {
    const filenameBatch = safeFilenamePart(batch);
    return new NextResponse(buildCsv(list, channel, batch), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="benmingmao-codes-${filenameBatch}.csv"`,
      },
    });
  }

  return NextResponse.json({
    count: list.length,
    codeLength: CODE_LENGTH,
    channel,
    batch,
    codes: list.map((code) => ({
      code,
      redeemUrl: redeemUrl(code),
      deliveryText: deliveryText(code),
    })),
  });
}
