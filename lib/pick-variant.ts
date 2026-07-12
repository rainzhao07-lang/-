import { createHash } from "node:crypto";

/**
 * 按 sessionId + 句位key 确定性选取变体。
 * SHA-256 的雪崩效应保证:同一用户各句位之间相互独立,
 * 不会出现"两个 sessionId 同余导致所有句位同时撞车"。
 */
export function pickVariant<T>(pool: readonly T[], sessionId: string, slotKey: string): T {
  if (pool.length === 0) throw new Error(`变体池为空: ${slotKey}`);
  const digest = createHash("sha256").update(`${sessionId}:${slotKey}`).digest();
  const index = digest.readUInt32BE(0) % pool.length;
  return pool[index];
}
