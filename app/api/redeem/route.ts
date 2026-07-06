import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentProvider } from "@/lib/payment/code-redemption";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/redeem — 兑换码核销
 * 错误信息统一为"兑换码无效或已使用",不区分不存在/已用,避免给爆破者反馈信号。
 */
export async function POST(req: Request) {
  // 同 IP 每分钟最多5次(任务书§7)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowRequest(`redeem:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "操作太频繁,请一分钟后再试" }, { status: 429 });
  }

  let body: { code?: unknown; sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!code || !sessionId) {
    return NextResponse.json({ error: "兑换码无效或已使用" }, { status: 400 });
  }

  const session = await db.getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "测试会话不存在,请重新测试" }, { status: 404 });
  }
  // 幂等:已付费的会话直接放行,不再消耗新码
  if (session.paid) {
    return NextResponse.json({ ok: true });
  }

  const ok = await paymentProvider.verify(sessionId, code);
  if (!ok) {
    return NextResponse.json({ error: "兑换码无效或已使用" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
