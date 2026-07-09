import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentSharedAccessCode, verifySharedAccessCode } from "./shared-access-code";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shared access code", () => {
  it("按北京时间小时窗口生成并仅接受当前时段", () => {
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "test-shared-secret");
    vi.stubEnv("SHARED_ACCESS_WINDOW_MINUTES", "60");

    const now = new Date("2026-07-09T10:12:00.000Z");
    const current = getCurrentSharedAccessCode(now);
    expect(current).not.toBeNull();
    expect(current?.code).toMatch(/^[A-Z0-9]{12}$/);
    expect(verifySharedAccessCode(current!.code, now)?.validUntil.toISOString()).toBe(current!.validUntil.toISOString());
    expect(verifySharedAccessCode(current!.code, new Date(current!.validUntil.getTime()))).toBeNull();
  });

  it("日码在北京时间零点轮换", () => {
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "test-shared-secret");
    vi.stubEnv("SHARED_ACCESS_WINDOW_MINUTES", "1440");

    const beforeMidnight = getCurrentSharedAccessCode(new Date("2026-07-09T15:59:59.000Z"));
    const afterMidnight = getCurrentSharedAccessCode(new Date("2026-07-09T16:00:00.000Z"));
    expect(beforeMidnight?.validUntil.toISOString()).toBe("2026-07-09T16:00:00.000Z");
    expect(afterMidnight?.validFrom.toISOString()).toBe("2026-07-09T16:00:00.000Z");
    expect(afterMidnight?.code).not.toBe(beforeMidnight?.code);
  });

  it("未配置共享密钥时不会开启共享兑换", () => {
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "");
    expect(getCurrentSharedAccessCode()).toBeNull();
    expect(verifySharedAccessCode("ABCDEFGHJKLM")).toBeNull();
  });
});
