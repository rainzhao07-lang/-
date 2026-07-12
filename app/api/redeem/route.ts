import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentProvider } from "@/lib/payment/code-redemption";
import { allowRequest } from "@/lib/rate-limit";
import {
  redeemSharedAccessCode,
  SHARED_DAILY_LIMIT_ERROR,
} from "@/lib/shared-access-redemption";
import { isExpiredPreviousSharedAccessCode } from "@/lib/shared-access-code";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowRequest(`redeem:ip:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "操作太频繁，请 1 分钟后再试" }, { status: 429 });
  }

  let body: { code?: unknown; sessionId?: unknown };
  try {
    body = (await req.json()) as { code?: unknown; sessionId?: unknown };
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!code || !sessionId) {
    return NextResponse.json({ error: "兑换码无效或已使用" }, { status: 400 });
  }

  if (!allowRequest(`redeem:session:${sessionId}`, 8, 60_000)) {
    return NextResponse.json({ error: "操作太频繁，请 1 分钟后再试" }, { status: 429 });
  }

  try {
    const session = await db.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "测试记录不存在，请重新测试" }, { status: 404 });
    }

    if (session.paid) {
      return NextResponse.json({ ok: true });
    }

    const oneTimeRedeemed = await paymentProvider.verify(sessionId, code);
    if (oneTimeRedeemed) {
      return NextResponse.json({ ok: true, mode: "one_time" });
    }

    const sharedRedeemed = await redeemSharedAccessCode(sessionId, code);
    if (sharedRedeemed === "limit_reached") {
      return NextResponse.json({ error: SHARED_DAILY_LIMIT_ERROR }, { status: 403 });
    }
    if (sharedRedeemed === "invalid") {
      if (isExpiredPreviousSharedAccessCode(code)) {
        return NextResponse.json(
          { error: "该限时码已更换(每天 18:00 轮换),请到获取渠道领取最新码。" },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: "兑换码无效或已使用" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, mode: "shared" });
  } catch (err) {
    console.error(`[redeem] infrastructure error session=${sessionId}:`, err);
    return NextResponse.json({ error: "服务暂时不可用，请稍后重试" }, { status: 503 });
  }
}
