import { NextResponse } from "next/server";
import { adminSecretMatches, hasAdminSecret } from "@/lib/admin-auth";
import { getCurrentSharedAccessCode } from "@/lib/shared-access-code";

export const runtime = "nodejs";

function redeemUrl(code: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  return `${base || ""}/redeem?code=${encodeURIComponent(code)}`;
}

export async function GET(req: Request) {
  if (!hasAdminSecret()) {
    return NextResponse.json({ error: "服务端未配置 ADMIN_SECRET" }, { status: 500 });
  }

  if (!adminSecretMatches(req.headers.get("x-admin-secret") ?? "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const shared = getCurrentSharedAccessCode();
    if (!shared) {
      return NextResponse.json({ error: "服务端未配置 SHARED_ACCESS_CODE_SECRET" }, { status: 503 });
    }

    const url = redeemUrl(shared.code);
    return NextResponse.json(
      {
        code: shared.code,
        validFrom: shared.validFrom.toISOString(),
        validUntil: shared.validUntil.toISOString(),
        windowMinutes: shared.windowMinutes,
        redeemUrl: url,
        deliveryText: `本命猫限时兑换码：${shared.code}\n有效期至：${shared.validUntil.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}（北京时间）\n测试入口：${url}\n请在有效期内完成测试并输入兑换码。`,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("[shared-code] configuration error:", error);
    return NextResponse.json({ error: "共享兑换码配置无效" }, { status: 500 });
  }
}
