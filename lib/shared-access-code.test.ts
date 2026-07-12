import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentSharedAccessCode, verifySharedAccessCode } from "./shared-access-code";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shared access code", () => {
  it("按北京时间小时窗口生成，并为上一时段保留15分钟宽限", () => {
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "test-shared-secret");
    vi.stubEnv("SHARED_ACCESS_WINDOW_MINUTES", "60");

    const now = new Date("2026-07-09T10:12:00.000Z");
    const current = getCurrentSharedAccessCode(now);
    expect(current).not.toBeNull();
    expect(current?.code).toMatch(/^[A-Z0-9]{12}$/);
    expect(verifySharedAccessCode(current!.code, now)?.validUntil.toISOString()).toBe(current!.validUntil.toISOString());
    expect(verifySharedAccessCode(current!.code, new Date(current!.validUntil.getTime()))).not.toBeNull();
    expect(verifySharedAccessCode(current!.code, new Date(current!.validUntil.getTime() + 15 * 60_000 + 1))).toBeNull();
  });

  it("日码在北京时间18点轮换", () => {
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "test-shared-secret");
    vi.stubEnv("SHARED_ACCESS_WINDOW_MINUTES", "1440");

    const beforeSix = getCurrentSharedAccessCode(new Date("2026-07-12T09:59:59.000Z"));
    const afterSix = getCurrentSharedAccessCode(new Date("2026-07-12T10:00:00.000Z"));
    expect(beforeSix?.validFrom.toISOString()).toBe("2026-07-11T10:00:00.000Z");
    expect(beforeSix?.validUntil.toISOString()).toBe("2026-07-12T10:00:00.000Z");
    expect(afterSix?.validFrom.toISOString()).toBe("2026-07-12T10:00:00.000Z");
    expect(afterSix?.validUntil.toISOString()).toBe("2026-07-13T10:00:00.000Z");
    expect(afterSix?.code).not.toBe(beforeSix?.code);
    expect(verifySharedAccessCode(beforeSix!.code, new Date("2026-07-12T10:00:00.000Z"))).not.toBeNull();
  });

  it("未配置共享密钥时不会开启共享兑换", () => {
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "");
    expect(getCurrentSharedAccessCode()).toBeNull();
    expect(verifySharedAccessCode("ABCDEFGHJKLM")).toBeNull();
  });
});
