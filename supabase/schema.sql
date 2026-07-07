-- 本命猫 H5 数据库 Schema
-- 在 Supabase SQL Editor 中执行本文件即可完成建表。
-- 服务端使用 service_role key 访问(不受 RLS 限制);
-- 三张表显式开启 RLS 且不建任何 policy → anon key 访问默认全部拒绝。

-- 一次测试会话
create table sessions (
  id uuid primary key default gen_random_uuid(),
  answers jsonb not null,            -- 12题答案数组(选项下标)
  persona_id text not null,          -- 计分结果
  hard_flags jsonb not null,         -- 硬条件标记(预算/空间等)
  premium_answers jsonb,             -- 付费定制题答案数组(选项下标)
  premium_flags jsonb,               -- 付费定制题汇总标签
  user_tier text not null default 'free' check (user_tier in ('free', 'paid')),
  paid boolean not null default false,
  created_at timestamptz default now()
);

-- 兑换码
create table redeem_codes (
  code text primary key,             -- 默认生成12位大写字母数字
  used boolean not null default false,
  used_by_session uuid references sessions(id),
  used_at timestamptz,
  created_at timestamptz default now()
);

-- 报告缓存(一个会话只生成一次,永不重复计费)
-- content = '' 的行是"生成中"占位:靠主键的原子插入实现跨实例生成锁
create table reports (
  session_id uuid primary key references sessions(id),
  content text not null,
  model text,
  created_at timestamptz default now()
);

-- 已部署过旧版 schema 的项目,可重复执行以下补列语句。
alter table sessions add column if not exists premium_answers jsonb;
alter table sessions add column if not exists premium_flags jsonb;
alter table sessions add column if not exists user_tier text not null default 'free';

-- 显式开启 RLS,不创建任何 policy = 非 service_role 一律拒绝
alter table sessions enable row level security;
alter table redeem_codes enable row level security;
alter table reports enable row level security;

-- 兑换码原子核销:校验码未用 + 标记已用 + 标记 session 已付费,单个事务内完成,
-- 杜绝"码已核销但 session 未标记付费"的中间态(Codex review P1)。
create or replace function redeem_code_and_mark_paid(p_code text, p_session uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if not exists (select 1 from sessions where id = p_session) then
    return false;
  end if;

  update redeem_codes
     set used = true, used_by_session = p_session, used_at = now()
   where code = p_code and used = false;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return false;
  end if;

  update sessions set paid = true, user_tier = 'paid' where id = p_session;
  return true;
end;
$$;
