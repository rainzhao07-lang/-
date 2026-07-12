import { NextResponse } from "next/server";
import { adminSecretMatches, hasAdminSecret } from "@/lib/admin-auth";
import { dbStorage } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!hasAdminSecret()) {
    return NextResponse.json({ error: "服务端未配置 ADMIN_SECRET" }, { status: 500 });
  }
  if (!adminSecretMatches(req.headers.get("x-admin-secret") ?? "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      storage: dbStorage,
      sharedCodeConfigured: Boolean(process.env.SHARED_ACCESS_CODE_SECRET?.trim()),
      payUrlConfigured: Boolean(process.env.NEXT_PUBLIC_PAY_URL?.trim()),
      siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
