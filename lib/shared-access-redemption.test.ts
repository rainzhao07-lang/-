import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { getCurrentSharedAccessCode } from "./shared-access-code";
import { redeemSharedAccessCode } from "./shared-access-redemption";

// 测试统一走 Db 接口这个 seam(未配 Supabase 时自动使用内存实现),
// 不触碰 db 内部存储结构;每个用例各建新会话,天然隔离。
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function createTestSession() {
  return db.createSession({ answers: [0, 1, 2], personaId: "p_test", hardFlags: {} });
}

describe("shared access redemption", () => {
  it("不会消耗一次性码库存，并且同一个共享码可以开通多个会话", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T03:00:00.000Z"));
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "test-shared-secret");
    vi.stubEnv("SHARED_ACCESS_WINDOW_MINUTES", "1440");
    const code = getCurrentSharedAccessCode()?.code;
    expect(code).toBeTruthy();

    const a = await createTestSession();
    const b = await createTestSession();

    await expect(redeemSharedAccessCode(a.id, code!)).resolves.toBe("redeemed");
    await expect(redeemSharedAccessCode(b.id, code!)).resolves.toBe("redeemed");
    expect((await db.getSession(a.id))?.paid).toBe(true);
    expect((await db.getSession(b.id))?.paid).toBe(true);
  });

  it("错误的共享码不开通会话", async () => {
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "test-shared-secret");
    const session = await createTestSession();

    await expect(redeemSharedAccessCode(session.id, "WRONGCODE999")).resolves.toBe("invalid");
    expect((await db.getSession(session.id))?.paid).toBe(false);
  });

  it("未配置共享码密钥时通道关闭", async () => {
    const session = await createTestSession();

    await expect(redeemSharedAccessCode(session.id, "ANYCODE12345")).resolves.toBe("invalid");
    expect((await db.getSession(session.id))?.paid).toBe(false);
  });

  it("markSessionPaid:已付费会话与不存在的会话都返回 false", async () => {
    const session = await createTestSession();

    await expect(db.markSessionPaid(session.id)).resolves.toBe(true);
    await expect(db.markSessionPaid(session.id)).resolves.toBe(false);
    await expect(db.markSessionPaid("no-such-session")).resolves.toBe(false);
  });

  it("每日上限为2时前两次成功，第三次被限额拒绝", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T03:00:00.000Z"));
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "limit-test-secret");
    vi.stubEnv("SHARED_ACCESS_WINDOW_MINUTES", "1440");
    vi.stubEnv("SHARED_DAILY_LIMIT", "2");
    const code = getCurrentSharedAccessCode()!.code;
    const sessions = await Promise.all([createTestSession(), createTestSession(), createTestSession()]);

    await expect(redeemSharedAccessCode(sessions[0].id, code)).resolves.toBe("redeemed");
    await expect(redeemSharedAccessCode(sessions[1].id, code)).resolves.toBe("redeemed");
    await expect(redeemSharedAccessCode(sessions[2].id, code)).resolves.toBe("limit_reached");
    expect((await db.getSession(sessions[2].id))?.paid).toBe(false);
  });

  it("宽限期核销计入旧窗口，不占用新窗口名额", async () => {
    const beforeRollover = new Date("2026-08-03T09:59:00.000Z");
    const withinGrace = new Date("2026-08-03T10:10:00.000Z");
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "grace-limit-secret");
    vi.stubEnv("SHARED_ACCESS_WINDOW_MINUTES", "1440");
    vi.stubEnv("SHARED_DAILY_LIMIT", "1");
    const oldCode = getCurrentSharedAccessCode(beforeRollover)!.code;
    const currentCode = getCurrentSharedAccessCode(withinGrace)!.code;
    vi.useFakeTimers();
    vi.setSystemTime(withinGrace);
    const oldFirst = await createTestSession();
    const currentFirst = await createTestSession();
    const oldSecond = await createTestSession();

    await expect(redeemSharedAccessCode(oldFirst.id, oldCode)).resolves.toBe("redeemed");
    await expect(redeemSharedAccessCode(currentFirst.id, currentCode)).resolves.toBe("redeemed");
    await expect(redeemSharedAccessCode(oldSecond.id, oldCode)).resolves.toBe("limit_reached");
  });
});
