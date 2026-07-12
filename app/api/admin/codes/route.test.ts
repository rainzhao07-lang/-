import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { GET } from "./route";

const ADMIN_SECRET = "test-admin-secret";

afterEach(() => {
  vi.unstubAllEnvs();
});

function configure() {
  vi.stubEnv("ADMIN_SECRET", ADMIN_SECRET);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://cat.example.com");
}

function request(query: string, secret = ADMIN_SECRET) {
  return new Request(`http://localhost/api/admin/codes?${query}`, {
    headers: { "x-admin-secret": secret },
  });
}

describe("GET /api/admin/codes", () => {
  it("按兑换码返回使用状态", async () => {
    configure();
    const code = "CODELOOKUP01";
    await db.insertCodes([code], { channel: "internal", batch: "lookup-test" });
    const session = await db.createSession({ answers: [0, 1, 2], personaId: "p_lookup", hardFlags: {} });
    await db.redeemCode(code, session.id);

    const response = await GET(request(`code=${code}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      found: true,
      code,
      used: true,
      usedBySession: session.id,
      channel: "internal",
      batch: "lookup-test",
    });
    expect(body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.usedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("按批次返回JSON并可导出追加使用状态的CSV", async () => {
    configure();
    const batch = "batch-export-test";
    await db.insertCodes(["EXPORTCODE01", "EXPORTCODE02"], { channel: "xiaohongshu", batch });

    const jsonResponse = await GET(request(`batch=${batch}`));
    const csvResponse = await GET(request(`batch=${batch}&format=csv`));
    const csv = await csvResponse.text();

    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toHaveLength(2);
    expect(csvResponse.status).toBe(200);
    expect(csv).toContain('"code","redeem_url","channel","batch","delivery_text","used","usedAt"');
    expect(csv).toContain('"EXPORTCODE01"');
    expect(csv).toContain('"false",""');
  });

  it("未授权请求不能查码", async () => {
    configure();

    const response = await GET(request("code=CODELOOKUP01", "wrong-secret"));

    expect(response.status).toBe(401);
  });
});
