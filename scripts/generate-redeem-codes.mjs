import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;
const DEFAULT_COUNT = 10_000;
const MAX_COUNT = 200_000;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq >= 0) {
      args[raw.slice(2, eq)] = raw.slice(eq + 1);
    } else {
      const key = raw.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/generate-redeem-codes.mjs --count=10000 --channel=xiaohongshu --batch=xhs-20260708-001 --site=https://your-domain.com",
    "",
    "Options:",
    "  --count    Number of codes to generate. Default: 10000. Max: 200000.",
    "  --channel  Sales channel label. Default: xiaohongshu.",
    "  --batch    Batch label. Default: xhs-YYYYMMDD-001.",
    "  --site     Public H5 base URL. Defaults to NEXT_PUBLIC_SITE_URL.",
    "  --out      Output directory. Defaults to E:\\Desktop-style parent of this repo.",
  ].join("\n");
}

function ymd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function timestamp(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${ymd(date)}-${hh}${mm}${ss}`;
}

function safeLabel(value, fallback, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  const normalized = (text || fallback).slice(0, maxLength);
  return normalized.replace(/[^\w.-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function safeFilenamePart(value) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "batch";
}

function parseCount(value) {
  const count = value === undefined ? DEFAULT_COUNT : Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`--count must be an integer between 1 and ${MAX_COUNT}`);
  }
  return count;
}

function randomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

function generateCodes(count) {
  const codes = new Set();
  while (codes.size < count) codes.add(randomCode());
  return [...codes];
}

function redeemUrl(site, code) {
  const base = site.replace(/\/$/, "");
  return base ? `${base}/redeem?code=${encodeURIComponent(code)}` : `/redeem?code=${encodeURIComponent(code)}`;
}

function csvCell(value) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function buildCsv(codes, { site, channel, batch }) {
  const rows = [
    ["code", "redeem_url", "channel", "batch", "delivery_text"],
    ...codes.map((code) => [
      code,
      redeemUrl(site, code),
      channel,
      batch,
      `兑换码：${code}\n测试入口：${redeemUrl(site, code)}\n完成测试后点击“解锁报告”即可使用。`,
    ]),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function sqlString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildSql(codes, { channel, batch }) {
  const chunks = [];
  const chunkSize = 500;
  for (let i = 0; i < codes.length; i += chunkSize) {
    const values = codes
      .slice(i, i + chunkSize)
      .map((code) => `  (${sqlString(code)}, ${sqlString(channel)}, ${sqlString(batch)})`)
      .join(",\n");
    chunks.push(
      [
        "insert into public.redeem_codes (code, channel, batch)",
        "values",
        values,
        "on conflict (code) do nothing;",
      ].join("\n"),
    );
  }

  return [
    "-- Import this file in Supabase SQL Editor after running supabase/schema.sql.",
    "-- Codes are plaintext because the current MVP table validates by exact code match.",
    "begin;",
    ...chunks,
    "commit;",
    "",
    "select",
    "  channel,",
    "  batch,",
    "  count(*) as total,",
    "  count(*) filter (where used = false and disabled = false) as available,",
    "  count(*) filter (where used = true) as used,",
    "  count(*) filter (where disabled = true) as disabled",
    "from public.redeem_codes",
    `where channel = ${sqlString(channel)} and batch = ${sqlString(batch)}`,
    "group by channel, batch;",
    "",
  ].join("\n");
}

function buildReadme({ count, channel, batch, site, csvName, sqlName }) {
  return [
    "# 本命猫兑换码库",
    "",
    `批次: ${batch}`,
    `渠道: ${channel}`,
    `数量: ${count}`,
    `测试入口: ${site || "未填写,CSV 中使用相对路径 /redeem?code=..."}`,
    "",
    "## 文件说明",
    "",
    `- ${csvName}: 给小红书/发卡平台使用,包含兑换码、入口链接和发货文案。`,
    `- ${sqlName}: 导入 Supabase 的 SQL,导入后系统才能自动识别这些兑换码。`,
    "",
    "## 使用顺序",
    "",
    "1. 先在 Supabase SQL Editor 执行项目里的 `supabase/schema.sql`,确保表结构和核销函数是最新版。",
    `2. 再执行本文件夹里的 \`${sqlName}\`。`,
    "3. 把 CSV 里的 `delivery_text` 作为小红书发货文案。",
    "4. 用户输入兑换码后,系统会检查 `redeem_codes` 表:未使用、未禁用才可核销;成功后立刻标记 `used=true`。",
    "",
    "## 注意",
    "",
    "- 这些码等同于付费权益,不要提交到 GitHub。",
    "- 如果正式域名变化,码本身仍可用,只需要更新发货文案里的入口链接。",
    "- 退款或异常订单可以在 Supabase 中把对应码 `disabled=true`。",
    "",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(usage());
    return;
  }

  const count = parseCount(args.count);
  const channel = safeLabel(args.channel, "xiaohongshu", 32);
  const batch = safeLabel(args.batch, `xhs-${ymd()}-001`, 64);
  const site = (args.site ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  const outDir =
    args.out !== undefined
      ? path.resolve(String(args.out))
      : path.resolve(process.cwd(), "..", `本命猫兑换码库-${timestamp()}`);

  const codes = generateCodes(count);
  const fileBase = safeFilenamePart(batch);
  const csvName = `benmingmao-codes-${fileBase}.csv`;
  const sqlName = `import-redeem-codes-${fileBase}.sql`;
  const readmeName = "使用说明.md";

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, csvName), `\uFEFF${buildCsv(codes, { site, channel, batch })}`, "utf8");
  await writeFile(path.join(outDir, sqlName), buildSql(codes, { channel, batch }), "utf8");
  await writeFile(
    path.join(outDir, readmeName),
    buildReadme({ count, channel, batch, site, csvName, sqlName }),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        count,
        channel,
        batch,
        site,
        outDir,
        files: [csvName, sqlName, readmeName],
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
