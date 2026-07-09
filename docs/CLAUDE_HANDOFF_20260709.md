# 本命猫 H5 - Claude 续接交付

生成时间：2026-07-09

这份文件是当前项目的续接入口。开始工作前，先阅读 `CLAUDE.md`、`README.md`、`docs/本命猫H5-ClaudeCode开发任务书.md` 和 `docs/本命猫-产品设计报告-V2.md`。

## 当前版本与源码

- 工作目录：`E:\Desktop\商业项目（本命猫）`
- GitHub：`https://github.com/rainzhao07-lang/-.git`
- 基线提交：`78794ff99a6659cb7aea0bb6d5cb5dbc75211b25` (`修复 Netlify Next 部署配置`)
- 当前分支：`main`
- 验证命令：`npm run check`（TypeScript 检查、Vitest、Next.js 生产构建）
- 本地开发：`npm run dev`，默认端口 `3100`

源码、内容数据、数据库 Schema 和兑换码生成脚本都在上述目录。不要把 `.env.local`、兑换码 CSV/TXT/SQL 或 `.netlify` 提交到 Git。

## 已上线状态

- 生产测试网址：[https://benmingmao-h5.netlify.app](https://benmingmao-h5.netlify.app)
- Netlify Site ID：`aa243315-f668-497e-b9a0-70e726e819fe`
- Netlify 配置：`netlify.toml`，使用 `@netlify/plugin-nextjs`
- 2026-07-09 已重新检查：`/`、`/quiz`、`/redeem` 均返回 HTTP 200。

如果 Netlify 再出现动态路由或 API 404，优先检查 `netlify.toml` 和 `@netlify/plugin-nextjs` 是否还在，再检查 Netlify 构建日志。不要把 `publish` 改回静态导出目录。

## 用户流程与实现位置

```
首页 -> 基础答题 -> 免费结果/分享卡 -> 兑换码核销
    -> 付费定制题 -> 本地规则生成深度报告 -> reports 缓存
```

- 计分：`lib/scoring.ts`，题库与人格数据在 `content/`。
- 付费定制题：`content/premiumQuestions.json`、`components/PremiumQuizFlow.tsx`。
- 报告：`lib/local-report.ts`，不调用外部大模型；报告接口为 `app/api/report/route.ts`。
- 兑换码入口/核销：`components/RedeemBox.tsx`、`app/api/redeem/route.ts`、`lib/payment/code-redemption.ts`。
- 数据访问：`lib/db.ts`。生产使用 Supabase；未配置 Supabase 时会退回内存数据库，只能用于本地演示。

## 数据库与兑换码

- Supabase 项目 Ref：`ycttcawpssiwlyqzxomy`。
- 结构文件：`supabase/schema.sql`。包含 `sessions`、`redeem_codes`、`reports` 三张表和原子核销函数 `redeem_code_and_mark_paid`。
- 核销原则：同一兑换码只可使用一次。函数在一个数据库操作里同时标记 `redeem_codes.used=true` 和 `sessions.paid=true`，避免只扣码未开通的中间状态。
- 批量生成：`npm run codes:generate -- --count=... --channel=... --batch=... --site=https://你的域名`。

桌面交付包中附带两批真实兑换码资产；它们没有进入 Git：

1. `本命猫兑换码库-20260708-192700`：正式小红书/Netlify 批次。包含原始 CSV、导入 Supabase 的 SQL、以及已排除已用验证码的 91 卡券 TXT。
2. `本命猫内测兑换码-20260709-001`：50 个内测码，包含仅代码 TXT、逐条发货文案、CSV 和 SQL。

历史记录显示正式批次的一枚代码已用于端到端核销验证。实际库存会持续变化，应在 Supabase 或发卡平台后台重新核对，不要以交付包中的数字作为实时库存。

## 运营与平台进度

- 91 卡券的唯一卡卡种和正式码导入文件已准备；`91卡券导入-正式码-9999条-已排除测试码.txt` 可用于库存导入。
- 91 卡券本身不能直接向小红书聊天自动发货。自动化链路需要“小红书订单 -> 已获授权的自动发货服务/阿奇索 -> 91 卡券库存 -> 买家收到兑换码”。
- 小红书当前可售类目曾显示为 `宠物/宠物食品及用品 > 宠物附属品 > 宠物周边及其他`，这会被平台按实物履约处理，不适合数字兑换码，不能提交该类目。
- 类目选择弹窗中出现过 `电子资源`。下一步应在其中查找 `电子凭证`、`虚拟服务`、`知识付费`、`线上服务`、`资料服务` 或 `数字内容`。如果没有对应末级类目，不要伪装成实物发货；需要改走小红书商家/服务市场允许的数字服务路径，或把小红书作为导流渠道。

## 环境变量与私密交接

生产所需变量名如下，值不在 Git，也不写入普通交付压缩包：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_SECRET
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_PAY_URL
```

`.env.example` 是变量模板；Netlify 环境变量是生产运行时的实际来源。Claude 如需改动部署或数据库，应由项目所有者在同一设备安全提供访问，或为 Claude 创建新密钥。不要通过 GitHub、公开聊天、商品详情页或发货文案传递 service-role key、数据库密码、Netlify token、隧道 token 或 `ADMIN_SECRET`。

此前这些敏感值曾在聊天中出现过。正式商业化前，项目所有者应轮换 Supabase 数据库密码和 service-role key、Netlify Personal Access Token、cpolar authtoken，以及 `ADMIN_SECRET`；轮换后同步更新 Netlify 环境变量。

## 优先待办

1. 完成小红书允许数字履约的商品类目与自动发货服务接入，不提交实物宠物周边类目。
2. 用一笔小额真实订单验证“下单 -> 发码 -> H5 核销 -> 报告生成”闭环。
3. 绑定正式域名，更新 `NEXT_PUBLIC_SITE_URL`，并重做发货文案中的入口链接。
4. 根据实际访问量，把 `lib/rate-limit.ts` 的单实例内存限流改为共享限流存储。
5. 上线前再次检查问题文案、隐私页和退款/数字内容规则是否与实际售卖渠道一致。
