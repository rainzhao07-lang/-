import { db } from "./db";
import { verifySharedAccessCode } from "./shared-access-code";

/**
 * 限时共享码在当前时段和上一时段的15分钟宽限期内有效。同一时段可为多个会话开通，
 * 因此不触碰 redeem_codes，也不会消耗正式的一次性库存。
 * 数据访问统一走 lib/db.ts 的 Db 接口（Supabase / 内存兜底由它决定）。
 */
export async function redeemSharedAccessCode(sessionId: string, code: string): Promise<boolean> {
  if (!verifySharedAccessCode(code)) return false;
  return db.markSessionPaid(sessionId);
}
