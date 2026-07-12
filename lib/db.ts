// 数据访问层。配置了 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 时走 Supabase(生产),
// 否则回落到进程内存(仅本地开发验证用,重启即失,启动时会打印警告)。
// 之所以留内存兜底:让工程在没有任何外部凭据时也能端到端跑通与验收,不改变生产行为。
//
// 计费安全的两条硬规则(Codex review P1 的修复):
// 1. 报告生成锁必须落库:reports 表的主键原子插入占位行(content=''),
//    多实例并发下也只有一个请求能拿到生成权;占位行超过 PENDING_TTL 视为
//    生成方崩溃,允许接管。
// 2. 基础设施错误(查询失败)绝不能吞成"缓存未命中",否则缓存层抖动会直接
//    变成重复生成与重复写入——查询失败一律抛错,由路由层返回 503。
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HardFlags, PremiumFlags } from "./types";

export type SessionRecord = {
  id: string;
  answers: number[];
  personaId: string;
  hardFlags: HardFlags;
  premiumAnswers: number[] | null;
  premiumFlags: PremiumFlags | null;
  userTier: "free" | "paid";
  paid: boolean;
  createdAt: string;
};

export type ReportRecord = {
  sessionId: string;
  content: string;
  model: string | null;
};

export type InsertCodesMeta = {
  channel: string;
  batch: string;
};

export type RedeemCodeRecord = {
  code: string;
  used: boolean;
  usedBySession: string | null;
  usedAt: string | null;
  channel: string;
  batch: string;
  createdAt: string;
};

export type DailyStatsRecord = {
  date: string;
  sessions: number;
  reports: number;
  oneTimeRedeems: number;
  sharedRedeems: number;
};

export type SharedRedemptionClaim =
  | { status: "recorded"; id: string }
  | { status: "limit_reached" };

/** claimReportGeneration 的三种结果:拿到生成权 / 已有缓存 / 别人正在生成 */
export type ReportClaim =
  | { status: "claimed" }
  | { status: "cached"; report: ReportRecord }
  | { status: "pending" };

// 占位行存活期:超过视为上一个生成方已崩溃,允许接管重新生成
const PENDING_TTL_MS = 5 * 60_000;
// 占位行的 model 标记(content='' 已是判据,此值仅便于人工排查)
const PENDING_MODEL = "__generating__";

export interface Db {
  createSession(data: { answers: number[]; personaId: string; hardFlags: HardFlags }): Promise<SessionRecord>;
  getSession(id: string): Promise<SessionRecord | null>;
  /** 保存付费定制题答案。允许先保存再核销兑换码,便于兑换码入口无缝进入报告。 */
  savePremiumAnswers(sessionId: string, answers: number[], premiumFlags: PremiumFlags): Promise<SessionRecord | null>;
  /** 原子核销:码存在且未用 → 标记已用 + session.paid=true,单事务完成。成功返回 true。 */
  redeemCode(code: string, sessionId: string): Promise<boolean>;
  /**
   * 直接把会话标记为已付费(限时共享码通道用,不消耗一次性码库存)。
   * 仅当会话存在且未付费时成功;不存在或已付费返回 false。基础设施错误抛出。
   */
  markSessionPaid(sessionId: string): Promise<boolean>;
  insertCodes(codes: string[], meta?: InsertCodesMeta): Promise<void>;
  getCode(code: string): Promise<RedeemCodeRecord | null>;
  listCodesByBatch(batch: string): Promise<RedeemCodeRecord[]>;
  getDailyStats(days: number, now?: Date): Promise<DailyStatsRecord[]>;
  recordSharedRedemption(windowStart: string, sessionId: string, limit: number | null): Promise<SharedRedemptionClaim>;
  removeSharedRedemption(id: string): Promise<void>;
  /**
   * 抢占报告生成权(跨实例安全)。基础设施错误直接抛,调用方应返回 503,
   * 绝不能把异常当成"无缓存"继续生成。
   */
  claimReportGeneration(sessionId: string): Promise<ReportClaim>;
  /** 生成成功:把占位行替换为正式内容 */
  finishReport(report: ReportRecord): Promise<void>;
  /** 生成失败:删除占位行,允许用户重试 */
  releaseReportClaim(sessionId: string): Promise<void>;
}

// ---------- Supabase 实现 ----------

function supabaseDb(url: string, serviceRoleKey: string): Db {
  const client: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return {
    async createSession({ answers, personaId, hardFlags }) {
      const { data, error } = await client
        .from("sessions")
        .insert({ answers, persona_id: personaId, hard_flags: hardFlags })
        .select()
        .single();
      if (error) throw new Error(`createSession failed: ${error.message}`);
      return rowToSession(data);
    },

    async getSession(id) {
      // 非法 uuid 会被 Postgres 拒绝(错误码 22P02),按"不存在"处理;
      // 其余错误(网络/服务故障)如实抛出,避免把故障误判为 404
      const { data, error } = await client.from("sessions").select().eq("id", id).maybeSingle();
      if (error) {
        if (error.code === "22P02") return null;
        throw new Error(`getSession failed: ${error.message}`);
      }
      return data ? rowToSession(data) : null;
    },

    async savePremiumAnswers(sessionId, answers, premiumFlags) {
      const { data, error } = await client
        .from("sessions")
        .update({
          premium_answers: answers,
          premium_flags: premiumFlags,
        })
        .eq("id", sessionId)
        .select()
        .maybeSingle();
      if (error) {
        if (error.code === "22P02") return null;
        throw new Error(`savePremiumAnswers failed: ${error.message}`);
      }
      return data ? rowToSession(data) : null;
    },

    async redeemCode(code, sessionId) {
      // 走 Postgres 事务函数(见 supabase/schema.sql):
      // 校验码未用 + 标记已用 + 标记 session 已付费,单事务原子完成
      const { data, error } = await client.rpc("redeem_code_and_mark_paid", {
        p_code: code,
        p_session: sessionId,
      });
      if (error) throw new Error(`redeemCode failed: ${error.message}`);
      return data === true;
    },

    async markSessionPaid(sessionId) {
      // 条件更新:仅 paid=false 的行会被命中,已付费/不存在都返回 false
      const { data, error } = await client
        .from("sessions")
        .update({ paid: true, user_tier: "paid" })
        .eq("id", sessionId)
        .eq("paid", false)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`markSessionPaid failed: ${error.message}`);
      return Boolean(data);
    },

    async insertCodes(codes, meta) {
      const rows = codes.map((code) => ({
        code,
        channel: meta?.channel ?? "manual",
        batch: meta?.batch ?? "default",
      }));
      const { error } = await client.from("redeem_codes").insert(rows);
      if (error) throw new Error(`insertCodes failed: ${error.message}`);
    },

    async getCode(code) {
      const { data, error } = await client
        .from("redeem_codes")
        .select("code, used, used_by_session, used_at, channel, batch, created_at")
        .eq("code", code)
        .maybeSingle();
      if (error) throw new Error(`getCode failed: ${error.message}`);
      return data ? rowToRedeemCode(data) : null;
    },

    async listCodesByBatch(batch) {
      const { data, error } = await client
        .from("redeem_codes")
        .select("code, used, used_by_session, used_at, channel, batch, created_at")
        .eq("batch", batch)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listCodesByBatch failed: ${error.message}`);
      return (data ?? []).map(rowToRedeemCode);
    },

    async getDailyStats(days, now = new Date()) {
      const { startIso, buckets } = createDailyStatsBuckets(days, now);
      const sessions = await selectDateColumn(client, "sessions", "created_at", startIso);
      const reports = await selectDateColumn(client, "reports", "created_at", startIso);
      const oneTimeRedeems = await selectDateColumn(client, "redeem_codes", "used_at", startIso);
      const sharedRedeems = await selectDateColumn(client, "shared_redemptions", "created_at", startIso);

      addDatesToBuckets(buckets, sessions, "sessions");
      addDatesToBuckets(buckets, reports, "reports");
      addDatesToBuckets(buckets, oneTimeRedeems, "oneTimeRedeems");
      addDatesToBuckets(buckets, sharedRedeems, "sharedRedeems");
      return [...buckets.values()];
    },

    async recordSharedRedemption(windowStart, sessionId, limit) {
      if (limit !== null) {
        const { count, error: countError } = await client
          .from("shared_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("window_start", windowStart);
        if (countError) throw new Error(`countSharedRedemptions failed: ${countError.message}`);
        if ((count ?? 0) >= limit) return { status: "limit_reached" };
      }

      const { data, error } = await client
        .from("shared_redemptions")
        .insert({ window_start: windowStart, session_id: sessionId })
        .select("id")
        .single();
      if (error) throw new Error(`recordSharedRedemption failed: ${error.message}`);
      return { status: "recorded", id: String(data.id) };
    },

    async removeSharedRedemption(id) {
      const { error } = await client.from("shared_redemptions").delete().eq("id", id);
      if (error) throw new Error(`removeSharedRedemption failed: ${error.message}`);
    },

    async claimReportGeneration(sessionId) {
      // 1) 尝试原子插入占位行:主键冲突即"已有人在做/已做完"
      const { error: insErr } = await client
        .from("reports")
        .insert({ session_id: sessionId, content: "", model: PENDING_MODEL });
      if (!insErr) return { status: "claimed" };
      if (insErr.code !== "23505") {
        // 非主键冲突 = 基础设施错误,必须抛(吞掉会导致重复计费)
        throw new Error(`claimReport insert failed: ${insErr.message}`);
      }

      // 2) 行已存在:读它,区分正式缓存与占位
      const { data, error: qErr } = await client
        .from("reports")
        .select()
        .eq("session_id", sessionId)
        .maybeSingle();
      if (qErr || !data) {
        throw new Error(`claimReport query failed: ${qErr?.message ?? "row disappeared"}`);
      }
      if (typeof data.content === "string" && data.content.length > 0) {
        return {
          status: "cached",
          report: { sessionId: data.session_id, content: data.content, model: data.model },
        };
      }

      // 3) 占位行:未过期 → 别人在生成;过期 → 条件更新接管(原子,双方最多一人成功)
      const cutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();
      const { data: takeover, error: tErr } = await client
        .from("reports")
        .update({ created_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("content", "")
        .lt("created_at", cutoff)
        .select();
      if (tErr) throw new Error(`claimReport takeover failed: ${tErr.message}`);
      if (takeover && takeover.length > 0) return { status: "claimed" };
      return { status: "pending" };
    },

    async finishReport({ sessionId, content, model }) {
      const { error } = await client
        .from("reports")
        .update({ content, model })
        .eq("session_id", sessionId);
      if (error) throw new Error(`finishReport failed: ${error.message}`);
    },

    async releaseReportClaim(sessionId) {
      // 只删占位行,绝不误删已生成的正式缓存
      const { error } = await client
        .from("reports")
        .delete()
        .eq("session_id", sessionId)
        .eq("content", "");
      if (error) {
        // 释放失败不致命:占位行会在 PENDING_TTL 后被接管,这里只记日志
        console.error(`[db] releaseReportClaim failed session=${sessionId}: ${error.message}`);
      }
    },
  };
}

function rowToSession(row: Record<string, unknown>): SessionRecord {
  const paid = Boolean(row.paid);
  return {
    id: row.id as string,
    answers: row.answers as number[],
    personaId: row.persona_id as string,
    hardFlags: (row.hard_flags ?? {}) as HardFlags,
    premiumAnswers: (row.premium_answers as number[] | null | undefined) ?? null,
    premiumFlags: (row.premium_flags as PremiumFlags | null | undefined) ?? null,
    userTier: row.user_tier === "paid" || paid ? "paid" : "free",
    paid,
    createdAt: row.created_at as string,
  };
}

function rowToRedeemCode(row: Record<string, unknown>): RedeemCodeRecord {
  return {
    code: row.code as string,
    used: Boolean(row.used),
    usedBySession: (row.used_by_session as string | null | undefined) ?? null,
    usedAt: (row.used_at as string | null | undefined) ?? null,
    channel: row.channel as string,
    batch: row.batch as string,
    createdAt: row.created_at as string,
  };
}

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;

function beijingDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function createDailyStatsBuckets(days: number, now: Date) {
  const beijingTodayStart = Math.floor((now.getTime() + BEIJING_OFFSET_MS) / DAY_MS) * DAY_MS;
  const firstBeijingDay = beijingTodayStart - (days - 1) * DAY_MS;
  const startIso = new Date(firstBeijingDay - BEIJING_OFFSET_MS).toISOString();
  const buckets = new Map<string, DailyStatsRecord>();

  for (let index = 0; index < days; index += 1) {
    const date = new Date(firstBeijingDay + index * DAY_MS).toISOString().slice(0, 10);
    buckets.set(date, { date, sessions: 0, reports: 0, oneTimeRedeems: 0, sharedRedeems: 0 });
  }

  return { startIso, buckets };
}

async function selectDateColumn(
  client: SupabaseClient,
  table: string,
  column: string,
  startIso: string,
): Promise<string[]> {
  const values: string[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from(table)
      .select(column)
      .gte(column, startIso)
      .order(column, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`selectDateColumn ${table}.${column} failed: ${error.message}`);

    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    for (const row of rows) {
      if (typeof row[column] === "string") values.push(row[column] as string);
    }
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return values;
}

function addDatesToBuckets(
  buckets: Map<string, DailyStatsRecord>,
  values: string[],
  field: keyof Omit<DailyStatsRecord, "date">,
) {
  for (const value of values) {
    const bucket = buckets.get(beijingDateKey(value));
    if (bucket) bucket[field] += 1;
  }
}

// ---------- 内存实现(本地开发兜底,语义与 Supabase 版对齐) ----------

type MemoryStore = {
  sessions: Map<string, SessionRecord>;
  codes: Map<string, {
    used: boolean;
    disabled: boolean;
    usedBySession?: string;
    usedAt?: string;
    channel: string;
    batch: string;
    createdAt: string;
  }>;
  reports: Map<string, ReportRecord & { createdAt: string }>;
  pendingReports: Map<string, number>; // sessionId → 抢占时间戳
  sharedRedemptions: Map<string, { id: string; windowStart: string; sessionId: string; createdAt: string }>;
};

function memoryDb(): Db {
  // 挂在 globalThis 上,躲过 Next dev 的热重载导致的模块重建
  const g = globalThis as typeof globalThis & { __bmm_store?: MemoryStore };
  g.__bmm_store ??= {
    sessions: new Map(),
    codes: new Map(),
    reports: new Map(),
    pendingReports: new Map(),
    sharedRedemptions: new Map(),
  };
  const store = g.__bmm_store;
  store.sharedRedemptions ??= new Map();

  return {
    async createSession({ answers, personaId, hardFlags }) {
      const record: SessionRecord = {
        id: crypto.randomUUID(),
        answers,
        personaId,
        hardFlags,
        premiumAnswers: null,
        premiumFlags: null,
        userTier: "free",
        paid: false,
        createdAt: new Date().toISOString(),
      };
      store.sessions.set(record.id, record);
      return record;
    },

    async getSession(id) {
      return store.sessions.get(id) ?? null;
    },

    async savePremiumAnswers(sessionId, answers, premiumFlags) {
      const session = store.sessions.get(sessionId);
      if (!session) return null;
      session.premiumAnswers = answers;
      session.premiumFlags = premiumFlags;
      return session;
    },

    async redeemCode(code, sessionId) {
      const entry = store.codes.get(code);
      const session = store.sessions.get(sessionId);
      if (!entry || entry.used || entry.disabled || !session) return false;
      entry.used = true;
      entry.usedBySession = sessionId;
      entry.usedAt = new Date().toISOString();
      session.paid = true;
      session.userTier = "paid";
      return true;
    },

    async markSessionPaid(sessionId) {
      const session = store.sessions.get(sessionId);
      if (!session || session.paid) return false;
      session.paid = true;
      session.userTier = "paid";
      return true;
    },

    async insertCodes(codes, meta) {
      for (const code of codes) {
        if (store.codes.has(code)) throw new Error(`duplicate code: ${code}`);
        store.codes.set(code, {
          used: false,
          disabled: false,
          channel: meta?.channel ?? "manual",
          batch: meta?.batch ?? "default",
          createdAt: new Date().toISOString(),
        });
      }
    },

    async getCode(code) {
      const entry = store.codes.get(code);
      return entry ? memoryCodeRecord(code, entry) : null;
    },

    async listCodesByBatch(batch) {
      return [...store.codes.entries()]
        .filter(([, entry]) => entry.batch === batch)
        .map(([code, entry]) => memoryCodeRecord(code, entry))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    },

    async getDailyStats(days, now = new Date()) {
      const { buckets } = createDailyStatsBuckets(days, now);
      addDatesToBuckets(buckets, [...store.sessions.values()].map((item) => item.createdAt), "sessions");
      addDatesToBuckets(
        buckets,
        [...store.reports.values()].map((item) => item.createdAt),
        "reports",
      );
      addDatesToBuckets(
        buckets,
        [...store.codes.values()].map((item) => item.usedAt).filter(Boolean) as string[],
        "oneTimeRedeems",
      );
      addDatesToBuckets(
        buckets,
        [...store.sharedRedemptions.values()].map((item) => item.createdAt),
        "sharedRedeems",
      );
      return [...buckets.values()];
    },

    async recordSharedRedemption(windowStart, sessionId, limit) {
      const count = [...store.sharedRedemptions.values()]
        .filter((item) => item.windowStart === windowStart).length;
      if (limit !== null && count >= limit) return { status: "limit_reached" };

      const id = crypto.randomUUID();
      store.sharedRedemptions.set(id, {
        id,
        windowStart,
        sessionId,
        createdAt: new Date().toISOString(),
      });
      return { status: "recorded", id };
    },

    async removeSharedRedemption(id) {
      store.sharedRedemptions.delete(id);
    },

    async claimReportGeneration(sessionId) {
      const cached = store.reports.get(sessionId);
      if (cached) return { status: "cached", report: cached };
      const claimedAt = store.pendingReports.get(sessionId);
      if (claimedAt !== undefined && Date.now() - claimedAt < PENDING_TTL_MS) {
        return { status: "pending" };
      }
      store.pendingReports.set(sessionId, Date.now());
      return { status: "claimed" };
    },

    async finishReport(report) {
      store.reports.set(report.sessionId, { ...report, createdAt: new Date().toISOString() });
      store.pendingReports.delete(report.sessionId);
    },

    async releaseReportClaim(sessionId) {
      store.pendingReports.delete(sessionId);
    },
  };
}

function memoryCodeRecord(
  code: string,
  entry: MemoryStore["codes"] extends Map<string, infer TValue> ? TValue : never,
): RedeemCodeRecord {
  return {
    code,
    used: entry.used,
    usedBySession: entry.usedBySession ?? null,
    usedAt: entry.usedAt ?? null,
    channel: entry.channel,
    batch: entry.batch,
    createdAt: entry.createdAt,
  };
}

// ---------- 单例导出 ----------

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseKey);

if (!useSupabase && process.env.NODE_ENV !== "test") {
  if (process.env.NODE_ENV === "production") {
    console.error("[db] 生产环境未配置 Supabase,正在使用内存兜底——严禁上线!");
  } else {
    console.warn("[db] 未配置 Supabase,使用内存数据库(仅限本地开发,数据重启即失)");
  }
}

export const dbStorage = useSupabase ? "supabase" : "memory";
export const db: Db = useSupabase ? supabaseDb(supabaseUrl!, supabaseKey!) : memoryDb();
