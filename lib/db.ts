// 数据访问层。配置了 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 时走 Supabase(生产),
// 否则回落到进程内存(仅本地开发验证用,重启即失,启动时会打印警告)。
// 之所以留内存兜底:让工程在没有任何外部凭据时也能端到端跑通与验收,不改变生产行为。
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HardFlags } from "./types";

export type SessionRecord = {
  id: string;
  answers: number[];
  personaId: string;
  hardFlags: HardFlags;
  paid: boolean;
  createdAt: string;
};

export type ReportRecord = {
  sessionId: string;
  content: string;
  model: string | null;
};

export interface Db {
  createSession(data: { answers: number[]; personaId: string; hardFlags: HardFlags }): Promise<SessionRecord>;
  getSession(id: string): Promise<SessionRecord | null>;
  /** 原子核销:码存在且未用 → 标记已用 + session.paid=true。成功返回 true。 */
  redeemCode(code: string, sessionId: string): Promise<boolean>;
  insertCodes(codes: string[]): Promise<void>;
  getReport(sessionId: string): Promise<ReportRecord | null>;
  saveReport(report: ReportRecord): Promise<void>;
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
      // 非法 uuid 会被 Postgres 拒绝,统一按"不存在"处理
      const { data, error } = await client.from("sessions").select().eq("id", id).maybeSingle();
      if (error) return null;
      return data ? rowToSession(data) : null;
    },

    async redeemCode(code, sessionId) {
      // 条件更新是单条原子语句:只有 used=false 时才能改成 used=true,
      // 两个并发请求最多一个能拿到受影响行 → 一码不可二用。
      const { data, error } = await client
        .from("redeem_codes")
        .update({ used: true, used_by_session: sessionId, used_at: new Date().toISOString() })
        .eq("code", code)
        .eq("used", false)
        .select();
      if (error || !data || data.length === 0) return false;

      const { error: payError } = await client
        .from("sessions")
        .update({ paid: true })
        .eq("id", sessionId);
      if (payError) throw new Error(`标记付费失败(码已核销 ${code}): ${payError.message}`);
      return true;
    },

    async insertCodes(codes) {
      const rows = codes.map((code) => ({ code }));
      const { error } = await client.from("redeem_codes").insert(rows);
      if (error) throw new Error(`insertCodes failed: ${error.message}`);
    },

    async getReport(sessionId) {
      const { data, error } = await client.from("reports").select().eq("session_id", sessionId).maybeSingle();
      if (error || !data) return null;
      return { sessionId: data.session_id, content: data.content, model: data.model };
    },

    async saveReport({ sessionId, content, model }) {
      const { error } = await client
        .from("reports")
        .upsert({ session_id: sessionId, content, model });
      if (error) throw new Error(`saveReport failed: ${error.message}`);
    },
  };
}

function rowToSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: row.id as string,
    answers: row.answers as number[],
    personaId: row.persona_id as string,
    hardFlags: (row.hard_flags ?? {}) as HardFlags,
    paid: Boolean(row.paid),
    createdAt: row.created_at as string,
  };
}

// ---------- 内存实现(本地开发兜底) ----------

type MemoryStore = {
  sessions: Map<string, SessionRecord>;
  codes: Map<string, { used: boolean; usedBySession?: string }>;
  reports: Map<string, ReportRecord>;
};

function memoryDb(): Db {
  // 挂在 globalThis 上,躲过 Next dev 的热重载导致的模块重建
  const g = globalThis as typeof globalThis & { __bmm_store?: MemoryStore };
  g.__bmm_store ??= { sessions: new Map(), codes: new Map(), reports: new Map() };
  const store = g.__bmm_store;

  return {
    async createSession({ answers, personaId, hardFlags }) {
      const record: SessionRecord = {
        id: crypto.randomUUID(),
        answers,
        personaId,
        hardFlags,
        paid: false,
        createdAt: new Date().toISOString(),
      };
      store.sessions.set(record.id, record);
      return record;
    },

    async getSession(id) {
      return store.sessions.get(id) ?? null;
    },

    async redeemCode(code, sessionId) {
      const entry = store.codes.get(code);
      const session = store.sessions.get(sessionId);
      if (!entry || entry.used || !session) return false;
      entry.used = true;
      entry.usedBySession = sessionId;
      session.paid = true;
      return true;
    },

    async insertCodes(codes) {
      for (const code of codes) {
        if (store.codes.has(code)) throw new Error(`duplicate code: ${code}`);
        store.codes.set(code, { used: false });
      }
    },

    async getReport(sessionId) {
      return store.reports.get(sessionId) ?? null;
    },

    async saveReport(report) {
      store.reports.set(report.sessionId, report);
    },
  };
}

// ---------- 单例导出 ----------

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseKey);

if (!useSupabase && process.env.NODE_ENV !== "test") {
  console.warn("[db] 未配置 Supabase,使用内存数据库(仅限本地开发,数据重启即失)");
}

export const db: Db = useSupabase ? supabaseDb(supabaseUrl!, supabaseKey!) : memoryDb();
