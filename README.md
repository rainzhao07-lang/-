# 本命猫 H5

一个移动端优先的猫咪匹配测试:基础题 → 铲屎官人格 + 本命猫品种(免费,含可保存分享卡)→ 兑换码解锁 → 付费定制题 → 本地规则生成《养猫决策报告》(¥9.9)。

产品与工程规格见 `docs/` 下两份文档。

## 技术栈

Next.js 15 (App Router) + TypeScript + Tailwind CSS | Supabase (Postgres) | 本地规则报告生成器 | next/og 分享卡 | Netlify 部署

## 本地开发

```powershell
npm install
npm run font:subset   # 首次需先下载字体源文件,见下方"分享卡字体"
npm run dev           # http://localhost:3100
```

不配任何环境变量也能跑通主要流程(内存数据库 + 本地报告生成器),用于开发验证:

1. 首页 → 答题 → 结果页
2. 生成兑换码(见下)→ 结果页输入 → 付费定制题 → 报告页出稿

```powershell
npm run check   # typecheck + 单测 + build,提交前必须全绿
```

## 环境变量

复制 `.env.example` 为 `.env.local`(本地)或配置到部署平台(生产)。生产环境建议配置下列变量。

| 变量 | 说明 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase 项目设置里获取。首次需在 SQL Editor 执行 `supabase/schema.sql` 建表 |
| `ADMIN_SECRET` | 生成兑换码接口的密钥,自定义强随机串 |
| `SHARED_ACCESS_CODE_SECRET` | 限时共享兑换码的签名密钥,使用与 `ADMIN_SECRET` 不同的强随机串 |
| `SHARED_ACCESS_WINDOW_MINUTES` | 共享码轮换周期,正式日码设为 `1440` |
| `SHARED_DAILY_LIMIT` | 共享码每个窗口的核销上限;留空或 `0` 表示不限 |
| `NEXT_PUBLIC_PAY_URL` | **生产必填。换购买入口只改这一个值**:当前为挂有商品入口的小红书笔记地址；缺失时构建会输出上线阻塞警告 |
| `NEXT_PUBLIC_SITE_URL` | 正式域名,用于分享卡短链与 og 分享 |

## 上线前必查

生产部署前必须确认以下变量都有正确值：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SECRET`
- `SHARED_ACCESS_CODE_SECRET`
- `NEXT_PUBLIC_PAY_URL`
- `NEXT_PUBLIC_SITE_URL`

`NEXT_PUBLIC_*` 前缀变量会在构建时固化到产物中，修改后必须重新部署才会生效。发布前还要通过管理员健康检查确认 `storage` 为 `supabase`，禁止以内存兜底状态上线。

## 运营者手册

### 替换/调优内容(不碰代码)

- **人格猫矩阵**:`content/personas.json` —— 当前是 8 个完整初稿,正式上线前请人工打磨(判词/巴纳姆文案/微反馈语料),可扩展到 10 个
- **题库**:`content/questions.json` —— 选项的 `weights` 决定人格得分,`flags` 是硬条件标记(注入报告,不影响人格结果)
- **付费定制题**:`content/premiumQuestions.json` —— 预算、居住、医疗承受力、情绪需求和报告风格都从这里汇总成标签
- **报告生成器**:`lib/local-report.ts` —— 本地规则和文案模块,不调用外部内容生成接口
- ⚠️ 改完 `personas.json` 必须重跑 `npm run font:subset`(分享卡字体按内容子集化,否则新字符不显示),然后重新部署
- 改完跑 `npm run test`:单测会自动校验数据完整性(weights 指向的人格存在、每个人格都能胜出等)
- 改完题库 `weights` 再跑 `npm run distribution:check`:蒙特卡洛模拟 50 万次答题,验证没有人格被挤到"几乎测不出来"(最高/最低占比 ≤ 2.5)。此检查也包含在 `npm run check` 里,提交前自动把关

### 生成兑换码

少量临时码可以直接调用后台接口:

```powershell
Invoke-RestMethod -Method Post -Uri "https://你的域名/api/admin/codes" `
  -Headers @{ "x-admin-secret" = "你的ADMIN_SECRET" } `
  -ContentType "application/json" -Body '{"count": 100, "channel": "xiaohongshu", "batch": "xhs-20260708-001"}'
```

返回的 `codes` 列表拿去面包多/发卡网配置"自动发货"。一码一次性核销。

小红书/批量发货建议用离线码库脚本,它会生成 CSV + Supabase SQL:

```powershell
npm run codes:generate -- --count=10000 --channel=xiaohongshu --batch=xhs-20260708-001 --site=https://你的正式域名
```

内测码建议单独批次生成,不要和正式发货码混用:

```powershell
npm run codes:generate -- --count=50 --channel=internal-test --batch=internal-test-YYYYMMDD-001 --site=https://benmingmao-h5.netlify.app
```

输出目录默认在项目上一层桌面目录,包含:

- `benmingmao-codes-*.csv`: 给小红书/发卡平台导入,含兑换码、入口链接、发货文案。
- `import-redeem-codes-*.sql`: 在 Supabase SQL Editor 执行,把这批码写入 `redeem_codes` 表。
- `codes-only-*.txt`: 只有兑换码本体,适合内部测试或导入卡密库。
- `delivery-messages-*.txt`: 每个码一段完整私信文案,适合直接发给内测伙伴。
- `使用说明.md`: 这批码的操作说明。

注意:生成出来的兑换码等同于付费权益,不要提交到 GitHub。

### 分享卡字体

分享卡用[霞鹜文楷](https://github.com/lxgw/LxgwWenKai)(可商用,SIL OFL 1.1)。源文件约24MB不入库:

1. 从 Releases 下载 `LXGWWenKai-Regular.ttf` 放到 `assets/fonts-src/`
2. `npm run font:subset` → 生成 `assets/fonts/card-font.ttf`(约260KB,入库)

## 部署(Netlify)

当前生产测试地址为 [https://benmingmao-h5.netlify.app](https://benmingmao-h5.netlify.app)，Netlify Site ID 为 `aa243315-f668-497e-b9a0-70e726e819fe`。仓库的 `netlify.toml` 已配置 `@netlify/plugin-nextjs`，不要删除该插件，否则 App Router 的动态路由和 API 会回到 404。

1. 推送仓库后，在 Netlify 的部署记录中确认该次构建已完成；不要假定每个 GitHub 推送都一定自动发布。
2. 在 Netlify 的环境变量中配置上表全部生产变量，尤其是 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_SECRET` 与 `NEXT_PUBLIC_SITE_URL`。
3. Supabase SQL Editor 执行 `supabase/schema.sql`；新项目必须先建表和 `redeem_code_and_mark_paid` 核销函数。
4. 绑定自有域名后，更新 `NEXT_PUBLIC_SITE_URL` 并重新部署。正式发货前用 `npm run codes:generate` 生成首批码，执行生成的 SQL 导入 Supabase，再把适用的 TXT/CSV 配置到发卡平台。
5. 验证：真机微信内置浏览器走通 答题 → 保存卡片 → 兑换 → 付费定制题 → 报告。每次上线前运行 `npm run check`。

## Phase 2 预留

- **官方支付**:`lib/payment/wechat-pay.todo.ts` 有完整替换说明;业务代码只依赖 `PaymentProvider` 接口
- **限流升级**:`lib/rate-limit.ts` 为单实例内存版,量大后换 Upstash/Supabase 计数,调用点不变
