import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/admin/stats", () => {
  it("按北京时间返回指定天数的完整漏斗结构", async () => {
    vi.stubEnv("ADMIN_SECRET", "test-admin-secret");
    vi.stubEnv("SHARED_DAILY_LIMIT", "1");
    await db.createSession({ answers: [0, 1, 2], personaId: "p_stats", hardFlags: {} });

    const response = await GET(new Request("http://localhost/api/admin/stats?days=2", {
      headers: { "x-admin-secret": "test-admin-secret" },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.days).toHaveLength(2);
    expect(body.days[1]).toEqual(expect.objectContaining({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      sessions: expect.any(Number),
      reports: expect.any(Number),
      oneTimeRedeems: expect.any(Number),
      sharedRedeems: expect.any(Number),
    }));
    expect(body.days[1].sessions).toBeGreaterThanOrEqual(1);
  });

  it("days 只接受1到30的整数", async () => {
    vi.stubEnv("ADMIN_SECRET", "test-admin-secret");

    const response = await GET(new Request("http://localhost/api/admin/stats?days=31", {
      headers: { "x-admin-secret": "test-admin-secret" },
    }));

    expect(response.status).toBe(400);
  });
});
