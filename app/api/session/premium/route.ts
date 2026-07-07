import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectPremiumFlags, validatePremiumAnswers } from "@/lib/premium";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** POST /api/session/premium — 保存付费定制题答案,只接受选项下标数组。 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowRequest(`premium:ip:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "操作太频繁，请 1 分钟后再试" }, { status: 429 });
  }

  let body: { sessionId?: unknown; premiumAnswers?: unknown };
  try {
    body = (await req.json()) as { sessionId?: unknown; premiumAnswers?: unknown };
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId || !validatePremiumAnswers(body.premiumAnswers)) {
    return NextResponse.json({ error: "定制题答案不完整或不合法" }, { status: 400 });
  }

  try {
    const session = await db.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "测试记录不存在，请重新测试" }, { status: 404 });
    }

    const premiumFlags = collectPremiumFlags(body.premiumAnswers);
    const updated = await db.savePremiumAnswers(sessionId, body.premiumAnswers, premiumFlags);
    if (!updated) {
      return NextResponse.json({ error: "测试记录不存在，请重新测试" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, premiumFlags });
  } catch (err) {
    console.error(`[premium-session] infrastructure error session=${sessionId}:`, err);
    return NextResponse.json({ error: "服务暂时不可用，请稍后重试" }, { status: 503 });
  }
}
