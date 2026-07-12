import { describe, expect, it } from "vitest";
import { pickVariant } from "./pick-variant";

describe("pickVariant", () => {
  it("同一会话与句位始终选择同一变体", () => {
    const pool = ["a", "b", "c", "d"] as const;
    const first = pickVariant(pool, "session-1", "risk.matching");

    expect(pickVariant(pool, "session-1", "risk.matching")).toBe(first);
  });

  it("不同句位使用独立摘要并能覆盖完整变体池", () => {
    const pool = ["a", "b", "c", "d"] as const;
    const selected = new Set(
      Array.from({ length: 64 }, (_, index) => pickVariant(pool, "session-1", `slot.${index}`)),
    );

    expect(selected).toEqual(new Set(pool));
  });

  it("空变体池立即报错并带出句位名", () => {
    expect(() => pickVariant([], "session-1", "empty.slot")).toThrow("变体池为空: empty.slot");
  });
});
