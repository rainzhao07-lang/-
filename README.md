# 本命猫 H5

一个移动端优先的 AI 猫咪匹配测试:12道题 → 铲屎官人格 + 本命猫品种(免费,含可保存分享卡)→ 兑换码解锁 → LLM 流式生成《养猫决策报告》(¥9.9)。

产品与工程规格见 `docs/` 下两份文档。

## 技术栈

Next.js 15 (App Router) + TypeScript + Tailwind CSS | Supabase (Postgres) | OpenAI 兼容 LLM(默认 DeepSeek)| next/og 分享卡 | Vercel 部署

## 本地开发

```powershell
npm install
npm run font:subset   # 首次需先下载字体源文件,见下方"分享卡字体"
npm run dev           # http://localhost:3100
```

不配任何环境变量也能完整跑通全流程(内存数据库 + mock 报告),用于开发验证:

1. 首页 → 答题 → 结果页
2. 生成兑换码(见下)→ 结果页输入 → 报告页流式出稿

```powershell
npm run check   # typecheck + 单测 + build,提交前必须全绿
```

## 环境变量

复制 `.env.example` 为 `.env.local`(本地)或配置到 Vercel(生产)。生产环境六个变量全部必填。

| 变量 | 说明 |
|---|---|
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | OpenAI 兼容接口。**换 LLM 供应商只改这三个值**,例如 DeepSeek: `https://api.deepseek.com` + `deepseek-chat` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase 项目设置里获取。首次需在 SQL Editor 执行 `supabase/schema.sql` 建表 |
| `ADMIN_SECRET` | 生成兑换码接口的密钥,自定义强随机串 |
| `NEXT_PUBLIC_PAY_URL` | **换收款链接只改这一个值**:面包多/发卡网商品页地址 |
| `NEXT_PUBLIC_SITE_URL` | 正式域名,用于分享卡短链与 og 分享 |

## 运营者手册

### 替换/调优内容(不碰代码)

- **人格猫矩阵**:`content/personas.json` —— 当前是 8 个完整初稿,正式上线前请人工打磨(判词/巴纳姆文案/微反馈语料),可扩展到 10 个
- **题库**:`content/questions.json` —— 选项的 `weights` 决定人格得分,`flags` 是硬条件标记(注入报告,不影响人格结果)
- **报告文风**:`content/prompts.ts` —— System Prompt 硬规则(结构五节/禁词/固定结尾)都在这里
- ⚠️ 改完 `personas.json` 必须重跑 `npm run font:subset`(分享卡字体按内容子集化,否则新字符不显示),然后重新部署
- 改完跑 `npm run test`:单测会自动校验数据完整性(weights 指向的人格存在、每个人格都能胜出等)

### 生成兑换码

```powershell
Invoke-RestMethod -Method Post -Uri "https://你的域名/api/card/../api/admin/codes" `
  -Headers @{ "x-admin-secret" = "你的ADMIN_SECRET" } `
  -ContentType "application/json" -Body '{"count": 100}'
```

返回的 `codes` 列表拿去面包多/发卡网配置"自动发货"。一码一次性核销。

### 分享卡字体

分享卡用[霞鹜文楷](https://github.com/lxgw/LxgwWenKai)(可商用,SIL OFL 1.1)。源文件约24MB不入库:

1. 从 Releases 下载 `LXGWWenKai-Regular.ttf` 放到 `assets/fonts-src/`
2. `npm run font:subset` → 生成 `assets/fonts/card-font.ttf`(约260KB,入库)

## 部署(Vercel)

1. 推送仓库 → Vercel 导入,配置上表全部环境变量
2. Supabase SQL Editor 执行 `supabase/schema.sql`
3. 绑定自有域名;上线后调 `/api/admin/codes` 生成首批码,配置到发卡平台
4. 验证:真机微信内置浏览器走通 答题→保存卡片→兑换→报告

## Phase 2 预留

- **官方支付**:`lib/payment/wechat-pay.todo.ts` 有完整替换说明;业务代码只依赖 `PaymentProvider` 接口
- **限流升级**:`lib/rate-limit.ts` 为单实例内存版,量大后换 Upstash/Supabase 计数,调用点不变
