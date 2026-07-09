import { afterEach, describe, expect, it, vi } from "vitest";
import { redeemSharedAccessCode } from "./shared-access-redemption";
import { getCurrentSharedAccessCode } from "./shared-access-code";

afterEach(() => {
  delete (globalThis as typeof globalThis & { __bmm_store?: unknown }).__bmm_store;
  vi.unstubAllEnvs();
});

describe("shared access redemption", () => {
  it("不会消耗一次性码库存，并且同一个共享码可以开通多个本地会话", async () => {
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "test-shared-secret");
    vi.stubEnv("SHARED_ACCESS_WINDOW_MINUTES", "1440");
    const code = getCurrentSharedAccessCode()?.code;
    expect(code).toBeTruthy();

    const sessions = new Map([
      ["session-a", { paid: false, userTier: "free" as const }],
      ["session-b", { paid: false, userTier: "free" as const }],
    ]);
    (globalThis as typeof globalThis & { __bmm_store?: { sessions: typeof sessions } }).__bmm_store = { sessions };

    await expect(redeemSharedAccessCode("session-a", code!)).resolves.toBe(true);
    await expect(redeemSharedAccessCode("session-b", code!)).resolves.toBe(true);
    expect(sessions.get("session-a")?.paid).toBe(true);
    expect(sessions.get("session-b")?.paid).toBe(true);
  });
});
