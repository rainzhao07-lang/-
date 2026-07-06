-- 本命猫 H5 数据库 Schema
-- 在 Supabase SQL Editor 中执行本文件即可完成建表。
-- 注意:服务端使用 service_role key 访问,以下三张表不开放匿名读写(保持默认 RLS 拒绝即可)。

-- 一次测试会话
create table sessions (
  id uuid primary key default gen_random_uuid(),
  answers jsonb not null,            -- 12题答案数组(选项下标)
  persona_id text not null,          -- 计分结果
  hard_flags jsonb not null,         -- 硬条件标记(预算/空间等)
  paid boolean not null default false,
  created_at timestamptz default now()
);

-- 兑换码
create table redeem_codes (
  code text primary key,             -- 8位大写字母数字
  used boolean not null default false,
  used_by_session uuid references sessions(id),
  used_at timestamptz,
  created_at timestamptz default now()
);

-- 报告缓存(一个会话只生成一次,永不重复计费)
create table reports (
  session_id uuid primary key references sessions(id),
  content text not null,
  model text,
  created_at timestamptz default now()
);
