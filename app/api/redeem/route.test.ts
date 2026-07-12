import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getCurrentSharedAccessCode } from "@/lib/shared-access-code";
import { POST } from "./route";

const BEFORE_ROLLOVER = new Date("2026-07-12T09:59:00.000Z");
const WITHIN_GRACE = new Date("2026-07-12T10:10:00.000Z");
const AFTER_GRACE = new Date("2026-07-12T10:20:00.000Z");

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function configureSharedCode() {
  vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "test-shared-secret");
  vi.stubEnv("SHARED_ACCESS_WINDOW_MINUTES", "1440");
}

async function createSession() {
  return db.createSession({ answers: [0, 1, 2], personaId: "p_test", hardFlags: {} });
}

async function redeem(sessionId: string, code: string, ip: string) {
  return POST(new Request("http://localhost/api/redeem", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ sessionId, code }),
  }));
}

describe("POST /api/redeem shared-code grace period", () => {
  it("17:59取得的日码在18:10仍可成功核销", async () => {
    configureSharedCode();
    const oldCode = getCurrentSharedAccessCode(BEFORE_ROLLOVER)!.code;
    vi.useFakeTimers();
    vi.setSystemTime(WITHIN_GRACE);
    const session = await createSession();

    const response = await redeem(session.id, oldCode, "198.51.100.11");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, mode: "shared" });
  });

  it("18:20核销上一窗口码时返回专属过期提示", async () => {
    configureSharedCode();
    const oldCode = getCurrentSharedAccessCode(BEFORE_ROLLOVER)!.code;
    vi.useFakeTimers();
    vi.setSystemTime(AFTER_GRACE);
    const session = await createSession();

    const response = await redeem(session.id, oldCode, "198.51.100.12");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "该限时码已更换(每天 18:00 轮换),请到获取渠道领取最新码。",
    });
  });

  it("18:20核销随机乱码时仍返回通用错误", async () => {
    configureSharedCode();
    vi.useFakeTimers();
    vi.setSystemTime(AFTER_GRACE);
    const session = await createSession();

    const response = await redeem(session.id, "WRONGCODE999", "198.51.100.13");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "兑换码无效或已使用" });
  });

  it("宽限期内上一窗口码与当前窗口码同时有效", async () => {
    configureSharedCode();
    const oldCode = getCurrentSharedAccessCode(BEFORE_ROLLOVER)!.code;
    const currentCode = getCurrentSharedAccessCode(WITHIN_GRACE)!.code;
    vi.useFakeTimers();
    vi.setSystemTime(WITHIN_GRACE);
    const oldCodeSession = await createSession();
    const currentCodeSession = await createSession();

    const oldResponse = await redeem(oldCodeSession.id, oldCode, "198.51.100.14");
    const currentResponse = await redeem(currentCodeSession.id, currentCode, "198.51.100.15");

    expect(oldResponse.status).toBe(200);
    expect(currentResponse.status).toBe(200);
    await expect(oldResponse.json()).resolves.toEqual({ ok: true, mode: "shared" });
    await expect(currentResponse.json()).resolves.toEqual({ ok: true, mode: "shared" });
  });

  it("共享码达到每日上限后返回403与指定文案", async () => {
    configureSharedCode();
    vi.stubEnv("SHARED_DAILY_LIMIT", "1");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T03:00:00.000Z"));
    const code = getCurrentSharedAccessCode()!.code;
    const first = await createSession();
    const second = await createSession();

    const firstResponse = await redeem(first.id, code, "198.51.100.21");
    const secondResponse = await redeem(second.id, code, "198.51.100.22");

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(403);
    await expect(secondResponse.json()).resolves.toEqual({
      error: "今天的限时名额已经用完啦——每天 18:00 会有新一批;不想等的话,购买兑换码可以立即解锁。",
    });
  });
});
