const BASE = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");
const ADMIN = process.env.ADMIN_SECRET;
if (!BASE || !ADMIN) {
  console.error("用法: SMOKE_BASE_URL=https://域名 ADMIN_SECRET=xxx node scripts/smoke-prod.mjs");
  process.exit(1);
}

const ANSWERS = [0, 3, 0, 1, 1, 1, 2, 1, 0, 0, 3, 1, 3, 3, 2, 3];
const PREMIUM = [1, 1, 1, 1, 0, 0, 1];
let failed = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` | ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function jsonReq(path, { method = "GET", body, admin = false } = {}) {
  const headers = { "content-type": "application/json" };
  if (admin) headers["x-admin-secret"] = ADMIN;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = null; }
  return { status: res.status, data, text };
}

async function main() {
  // 1. 健康检查:生产必须是 supabase
  const health = await jsonReq("/api/admin/health", { admin: true });
  check("health 接口可用", health.status === 200, `status=${health.status}`);
  check("存储为 supabase(严禁内存兜底)", health.data?.storage === "supabase", `storage=${health.data?.storage}`);
  check("PAY_URL 已配置", health.data?.payUrlConfigured === true);
  check("SITE_URL 已配置", health.data?.siteUrlConfigured === true);
  check("共享码密钥已配置", health.data?.sharedCodeConfigured === true);

  // 2. 建会话
  const session = await jsonReq("/api/session", { method: "POST", body: { answers: ANSWERS } });
  const sessionId = session.data?.sessionId;
  check("创建会话", session.status === 200 && Boolean(sessionId), `persona=${session.data?.persona?.title ?? "?"}`);
  if (!sessionId) return;

  // 3. 结果页:200 且付费入口存在(不得出现兜底文案)
  const resultPage = await fetch(`${BASE}/result/${sessionId}`);
  const resultHtml = await resultPage.text();
  check("结果页 200", resultPage.status === 200);
  check("付费入口存在(无兜底文案)", !resultHtml.includes("购买入口暂时维护中"));

  // 4. 生成一次性码并核销
  const created = await jsonReq("/api/admin/codes", { method: "POST", admin: true, body: { count: 1, channel: "smoke", batch: "smoke" } });
  const code = created.data?.codes?.[0]?.code;
  check("生成一次性码", created.status === 200 && Boolean(code));
  if (!code) return;
  await sleep(1200);
  const redeem = await jsonReq("/api/redeem", { method: "POST", body: { code, sessionId } });
  check("一次性码核销", redeem.status === 200 && redeem.data?.mode === "one_time");

  // 5. 定制题与报告
  const premium = await jsonReq("/api/session/premium", { method: "POST", body: { sessionId, premiumAnswers: PREMIUM } });
  check("提交定制题", premium.status === 200 && premium.data?.ok === true);
  const report1 = await jsonReq("/api/report", { method: "POST", body: { sessionId } });
  check("报告生成", report1.status === 200 && report1.text.length > 800, `${report1.text.length}字`);
  check("报告含综合判断", report1.text.includes("综合判断"));
  const report2 = await jsonReq("/api/report", { method: "POST", body: { sessionId } });
  check("报告缓存一致(种子稳定)", report2.text === report1.text);

  // 6. 一码一用:同码用于新会话必须失败
  const session2 = await jsonReq("/api/session", { method: "POST", body: { answers: ANSWERS } });
  const sessionId2 = session2.data?.sessionId;
  await sleep(1200);
  const reuse = await jsonReq("/api/redeem", { method: "POST", body: { code, sessionId: sessionId2 } });
  check("一码一用(复用被拒)", reuse.status === 400);

  // 7. 无效码报错
  await sleep(1200);
  const invalid = await jsonReq("/api/redeem", { method: "POST", body: { code: "AAAABBBBCCCC", sessionId: sessionId2 } });
  check("无效码返回400", invalid.status === 400, invalid.data?.error ?? "");

  // 8. 共享码核销
  const shared = await jsonReq("/api/admin/shared-code", { admin: true });
  const sharedCode = shared.data?.code ?? shared.data?.sharedCode;
  check("读取当前共享码", shared.status === 200 && Boolean(sharedCode));
  if (sharedCode && sessionId2) {
    await sleep(1200);
    const sharedRedeem = await jsonReq("/api/redeem", { method: "POST", body: { code: sharedCode, sessionId: sessionId2 } });
    check("共享码核销", sharedRedeem.status === 200 && sharedRedeem.data?.mode === "shared");
  }

  console.log(failed === 0 ? "\n全部通过 ✅" : `\n${failed} 项失败 ❌`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error("冒烟脚本异常:", err);
  process.exit(1);
});
