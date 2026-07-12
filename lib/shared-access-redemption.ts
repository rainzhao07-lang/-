import { db } from "./db";
import { verifySharedAccessCode } from "./shared-access-code";

export const SHARED_DAILY_LIMIT_ERROR =
  "今天的限时名额已经用完啦——每天 18:00 会有新一批;不想等的话,购买兑换码可以立即解锁。";

export type SharedAccessRedemptionResult = "redeemed" | "invalid" | "limit_reached";

function configuredDailyLimit(): number | null {
  const raw = process.env.SHARED_DAILY_LIMIT?.trim();
  if (!raw || raw === "0") return null;

  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("SHARED_DAILY_LIMIT 必须是正整数、0或留空");
  }
  return limit;
}

/**
 * 限时共享码在当前时段和上一时段的15分钟宽限期内有效。同一时段可为多个会话开通，
 * 因此不触碰 redeem_codes，也不会消耗正式的一次性库存。
 * 数据访问统一走 lib/db.ts 的 Db 接口（Supabase / 内存兜底由它决定）。
 */
export async function redeemSharedAccessCode(
  sessionId: string,
  code: string,
): Promise<SharedAccessRedemptionResult> {
  const sharedCode = verifySharedAccessCode(code);
  if (!sharedCode) return "invalid";

  const claim = await db.recordSharedRedemption(
    sharedCode.validFrom.toISOString(),
    sessionId,
    configuredDailyLimit(),
  );
  if (claim.status === "limit_reached") return "limit_reached";

  const paid = await db.markSessionPaid(sessionId);
  if (!paid) {
    await db.removeSharedRedemption(claim.id);
    return "invalid";
  }
  return "redeemed";
}
