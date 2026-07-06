// 极简滑动窗口限流(内存版)。
// 注意:Vercel Serverless 多实例间不共享内存,此限流为"单实例内"的最低防线,
// MVP 阶段(兑换码只有8位随机大写字母数字,爆破空间巨大)足够;
// Phase 2 若需要更强防护,换 Upstash Redis 或 Supabase 计数即可,调用点不变。
const buckets = new Map<string, number[]>();

export function allowRequest(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  // 防止 Map 无限增长
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return true;
}
