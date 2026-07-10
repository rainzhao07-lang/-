import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { getCurrentSharedAccessCode } from "./shared-access-code";
import { redeemSharedAccessCode } from "./shared-access-redemption";

// 测试统一走 Db 接口这个 seam(未配 Supabase 时自动使用内存实现),
// 不触碰 db 内部存储结构;每个用例各建新会话,天然隔离。
afterEach(() => {
  vi.unstubAllEnvs();
});

function createTestSession() {
  return db.createSession({ answers: [0, 1, 2], personaId: "p_test", hardFlags: {} });
}

describe("shared access redemption", () => {
  it("不会消耗一次性码库存，并且同一个共享码可以开通多个会话", async () => {
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "test-shared-secret");
    vi.stubEnv("SHARED_ACCESS_WINDOW_MINUTES", "1440");
    const code = getCurrentSharedAccessCode()?.code;
    expect(code).toBeTruthy();

    const a = await createTestSession();
    const b = await createTestSession();

    await expect(redeemSharedAccessCode(a.id, code!)).resolves.toBe(true);
    await expect(redeemSharedAccessCode(b.id, code!)).resolves.toBe(true);
    expect((await db.getSession(a.id))?.paid).toBe(true);
    expect((await db.getSession(b.id))?.paid).toBe(true);
  });

  it("错误的共享码不开通会话", async () => {
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "test-shared-secret");
    const session = await createTestSession();

    await expect(redeemSharedAccessCode(session.id, "WRONGCODE999")).resolves.toBe(false);
    expect((await db.getSession(session.id))?.paid).toBe(false);
  });

  it("未配置共享码密钥时通道关闭", async () => {
    const session = await createTestSession();

    await expect(redeemSharedAccessCode(session.id, "ANYCODE12345")).resolves.toBe(false);
    expect((await db.getSession(session.id))?.paid).toBe(false);
  });

  it("markSessionPaid:已付费会话与不存在的会话都返回 false", async () => {
    const session = await createTestSession();

    await expect(db.markSessionPaid(session.id)).resolves.toBe(true);
    await expect(db.markSessionPaid(session.id)).resolves.toBe(false);
    await expect(db.markSessionPaid("no-such-session")).resolves.toBe(false);
  });
});
