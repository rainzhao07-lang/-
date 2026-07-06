import { randomInt, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// 排除易混淆字符(0/O、1/I/L)的字符表
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const MAX_BATCH = 1000;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * POST /api/admin/codes — 批量生成兑换码(运营者拿去发卡平台配置自动发货)
 * 鉴权:Header `x-admin-secret` 必须等于环境变量 ADMIN_SECRET。
 */
export async function POST(req: Request) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "服务端未配置 ADMIN_SECRET" }, { status: 500 });
  }
  const provided = req.headers.get("x-admin-secret") ?? "";
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) {
    return NextResponse.json({ error: `count 必须是 1-${MAX_BATCH} 的整数` }, { status: 400 });
  }

  // 批内去重;与库中已有码撞车的概率约为 n/31^8(可忽略),撞上则由主键约束报错,重试即可
  const codes = new Set<string>();
  while (codes.size < count) codes.add(randomCode());
  const list = [...codes];

  await db.insertCodes(list);
  return NextResponse.json({ count: list.length, codes: list });
}
