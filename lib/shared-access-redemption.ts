import { createClient } from "@supabase/supabase-js";
import { verifySharedAccessCode } from "./shared-access-code";

type MemorySession = {
  paid: boolean;
  userTier: "free" | "paid";
};

type MemoryStore = {
  sessions: Map<string, MemorySession>;
};

function localMemoryStore(): MemoryStore | null {
  const globalStore = globalThis as typeof globalThis & { __bmm_store?: MemoryStore };
  return globalStore.__bmm_store ?? null;
}

/**
 * 限时共享码只在当前时段有效。同一时段可为多个会话开通，
 * 因此不触碰 redeem_codes，也不会消耗正式的一次性库存。
 */
export async function redeemSharedAccessCode(sessionId: string, code: string): Promise<boolean> {
  if (!verifySharedAccessCode(code)) return false;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceRoleKey) {
    const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const { data, error } = await client
      .from("sessions")
      .update({ paid: true, user_tier: "paid" })
      .eq("id", sessionId)
      .eq("paid", false)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`redeem shared code failed: ${error.message}`);
    return Boolean(data);
  }

  // 本地开发与现有内存数据库对齐；生产环境必须使用 Supabase。
  const store = localMemoryStore();
  const session = store?.sessions.get(sessionId);
  if (!session || session.paid) return false;
  session.paid = true;
  session.userTier = "paid";
  return true;
}
