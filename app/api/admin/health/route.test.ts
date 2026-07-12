import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(secret = "test-admin-secret") {
  return new Request("http://localhost/api/admin/health", {
    headers: { "x-admin-secret": secret },
  });
}

describe("GET /api/admin/health", () => {
  it("拒绝错误的管理员密钥", async () => {
    vi.stubEnv("ADMIN_SECRET", "test-admin-secret");

    const response = await GET(request("wrong-secret"));

    expect(response.status).toBe(401);
  });

  it("返回存储类型与三项生产配置状态", async () => {
    vi.stubEnv("ADMIN_SECRET", "test-admin-secret");
    vi.stubEnv("SHARED_ACCESS_CODE_SECRET", "shared-secret");
    vi.stubEnv("NEXT_PUBLIC_PAY_URL", "https://pay.example.com/item");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://cat.example.com");

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      storage: "memory",
      sharedCodeConfigured: true,
      payUrlConfigured: true,
      siteUrlConfigured: true,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
