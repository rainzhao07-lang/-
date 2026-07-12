import { NextResponse } from "next/server";
import { adminSecretMatches, hasAdminSecret } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!hasAdminSecret()) {
    return NextResponse.json({ error: "服务端未配置 ADMIN_SECRET" }, { status: 500 });
  }
  if (!adminSecretMatches(req.headers.get("x-admin-secret") ?? "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawDays = new URL(req.url).searchParams.get("days") ?? "7";
  const days = Number(rawDays);
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    return NextResponse.json({ error: "days 必须是 1-30 的整数" }, { status: 400 });
  }

  try {
    return NextResponse.json({ days: await db.getDailyStats(days) });
  } catch (error) {
    console.error("[admin/stats] query failed:", error);
    return NextResponse.json({ error: "统计查询失败，请稍后重试" }, { status: 503 });
  }
}
