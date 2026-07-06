# 本命猫 H5 — Claude Code 开发任务书 V1.0

> 使用方式：将本文档放入项目根目录（可命名为 CLAUDE.md 或直接粘贴给 Claude Code），按里程碑顺序执行。每个里程碑有验收标准，完成一个再进入下一个。

---

## 0. 你要构建什么

一个移动端优先的付费测试H5「本命猫」：用户答12道题 → 计分引擎匹配出"铲屎官人格"与"本命猫品种" → 免费展示结果与可下载的分享卡 → 用户凭兑换码解锁 → 调用LLM流式生成个性化"养猫决策报告"。

**工程总则：**
1. 移动端优先（375px基准），桌面端只需不破版
2. 简单优先，禁止过度设计。不引入任务书未提及的库/服务，除非说明理由
3. **引擎与内容分离**：所有人格、题目、文案存于 `/content` 目录的数据文件，产品运营者只改数据文件即可调优，不触碰组件代码
4. 全站中文，视觉基调：温暖、治愈、有猫的柔软感（奶油底色 + 一个暖色主色调），拒绝廉价的算命风视觉

**明确不做（红线）：**
- ❌ 用户登录/注册系统（用 sessionId 定位一切）
- ❌ 管理后台UI（管理操作走带密钥的API + SQL）
- ❌ 小程序、i18n、暗色模式
- ❌ 任何"占卜/命理/运势/算命"类文案（含代码注释与Prompt）
- ❌ 在前端暴露任何密钥；LLM调用只在服务端发生

---

## 1. 技术栈（锁定，不做替换）

| 层 | 选型 |
|---|---|
| 框架 | Next.js 14+ App Router + TypeScript |
| 样式 | Tailwind CSS，可少量使用 framer-motion 做答题动效 |
| 数据库 | Supabase (Postgres)，服务端用 service_role key 访问 |
| LLM | OpenAI 兼容接口，通过环境变量配置 baseURL/model（默认对接 DeepSeek），服务端调用，流式输出 |
| 分享卡 | `@vercel/og` 服务端生成 1080×1440 PNG（3:4竖版），需内嵌中文字体文件（选一款可商用开源中文字体，subset后打包） |
| 部署 | Vercel |

## 2. 环境变量（.env.example 需包含）

```
LLM_BASE_URL=          # 例如 https://api.deepseek.com
LLM_API_KEY=
LLM_MODEL=             # 例如 deepseek-chat
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_SECRET=          # 管理API的鉴权密钥
NEXT_PUBLIC_PAY_URL=   # 面包多/发卡网商品页外链
```

## 3. 数据库Schema（生成 supabase/schema.sql）

```sql
-- 一次测试会话
create table sessions (
  id uuid primary key default gen_random_uuid(),
  answers jsonb not null,            -- 12题答案数组
  persona_id text not null,          -- 计分结果
  hard_flags jsonb not null,         -- 硬条件标记（预算/空间等）
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

-- 报告缓存（一个会话只生成一次，永不重复计费）
create table reports (
  session_id uuid primary key references sessions(id),
  content text not null,
  model text,
  created_at timestamptz default now()
);
```

## 4. 内容数据文件（/content 目录，引擎的燃料）

### 4.1 `/content/personas.json` — 人格猫矩阵

Schema 及2个示例（**先放这2个真实示例 + 6个结构完整的占位人格**，保证应用端到端可跑，正式内容由运营者后续替换）：

```json
[
  {
    "id": "snow_hermit",
    "title": "雪山隐士",
    "subtitle": "外冷内热型",
    "verdict": "你们都以为它高冷，只有你知道它有多黏人——像极了你自己。",
    "freeTeaser": "你身上有一种连自己都没察觉的矛盾感：越是在乎，表面越是平静。",
    "primaryBreed": { "name": "布偶猫", "reason": "和你一样，外表清冷疏离，实际上认定一个人就黏到骨子里。" },
    "altBreeds": [
      { "name": "银渐层", "reason": "安静的陪伴者，懂你不说话的时刻。" },
      { "name": "田园奶牛猫", "reason": "被低估的宝藏，热情藏在熟悉之后。" }
    ],
    "microFeedbackPool": [
      "嗯……你是那种嘴上说随便、心里早有答案的人吧？",
      "你好像习惯把心事收得很好。"
    ],
    "cardTheme": { "bg": "#EEF3F8", "accent": "#6B8CAE" }
  },
  {
    "id": "city_observer",
    "title": "城市观察家",
    "subtitle": "清醒松弛型",
    "verdict": "你不追热闹，热闹自己会来找你——它也一样。",
    "freeTeaser": "你的松弛不是懒，是一种筛选：值得的事你从不含糊。",
    "primaryBreed": { "name": "英国短毛猫", "reason": "情绪稳定的老搭档，和你一样把日子过得从容有秩序。" },
    "altBreeds": [
      { "name": "美国短毛猫", "reason": "皮实好养的乐天派，配得上你的高效人生。" },
      { "name": "田园狸花猫", "reason": "聪明独立的原生高手，无需讨好，彼此尊重。" }
    ],
    "microFeedbackPool": [
      "看得出来，你是先观察再行动的人。",
      "你对生活的要求，其实比你表现出来的高。"
    ],
    "cardTheme": { "bg": "#F5F1E8", "accent": "#B08968" }
  }
]
```

### 4.2 `/content/questions.json` — 题库

12题结构，每个选项携带：人格权重向量 + 可选硬条件标记。示例2题 + 10题占位：

```json
[
  {
    "id": "q1",
    "text": "周五晚上10点，你最可能在？",
    "options": [
      { "text": "家里沙发上，和自己待着", "weights": { "snow_hermit": 3, "city_observer": 1 }, "flags": {} },
      { "text": "刚回家，白天已经排满", "weights": { "city_observer": 3 }, "flags": {} },
      { "text": "和两三好友小聚", "weights": {}, "flags": {} },
      { "text": "还在加班/学习", "weights": {}, "flags": { "schedule": "busy" } }
    ]
  },
  {
    "id": "q7",
    "text": "关于掉毛，你的真实底线是？",
    "options": [
      { "text": "完全不能接受，我有洁癖", "weights": {}, "flags": { "shedding": "low" } },
      { "text": "少量可以，定期打理没问题", "weights": {}, "flags": { "shedding": "mid" } },
      { "text": "无所谓，粘毛器我有一打", "weights": {}, "flags": { "shedding": "high" } }
    ]
  }
]
```

微反馈机制：在第4题、第8题答完后，取当前累计得分最高人格的 `microFeedbackPool` 随机一句，以气泡动画插入（纯规则驱动，不调LLM，零成本零延迟）。

### 4.3 `/content/prompts.ts` — 报告生成Prompt模板

导出一个模板函数，注入：persona对象、用户答案摘要、hard_flags。System Prompt 必须包含以下硬规则：

- 身份：温暖、专业、有文采的"猫格鉴定师"，中文写作
- 结构（用小标题分节，总长900-1200字）：① 你的猫系人格（巴纳姆式剖析，其中必须有一段直击内心的"被看见"句子）② 为什么是{primaryBreed}（结合用户具体答案，拟人化）③ 两只备选与横向对比 ④ 真实养育须知：该品种性格真相/健康注意点/月均花费区间/新手第一个月清单 ⑤ 彩蛋：为这只未来的猫起3个有寓意的名字
- 语气规则：缺点写成"代价与美感"，永不贬损用户；所有品种描述基于常识性事实，花费给区间不给绝对值
- 禁词：占卜、命理、运势、注定（用"契合""匹配"替代）
- 结尾固定两句：领养代替购买的倡导（说明田园猫中同样存在这些性格特质）+ 温和免责（本报告为参考建议，每只猫都是独立个体）

## 5. 计分引擎（/lib/scoring.ts，纯函数）

1. 累加所有选项的 weights → 得分最高的 persona 胜出；平分时按 personas.json 中的顺序取先者（保证确定性：同样答案永远同样结果）
2. 汇总所有 flags 为 hard_flags 对象，存入 session，并注入报告Prompt（例如 shedding:"low" 时，报告须诚实提示布偶掉毛现实并给出打理方案——**硬条件不改变人格结果，但必须改变建议内容**）
3. 单元测试：给定固定答案数组断言 persona 输出稳定

## 6. 页面规格

### `/` 落地页
- 主标题：**「测测你内心住着哪只猫」**
- 副标题：你的人格猫，就是你该养的那只。AI帮你3分钟避开冲动养猫的坑。
- 价格透明徽章（必须显著）：`基础结果免费 · 深度报告 ¥9.9`
- CTA按钮：开始测试 → /quiz
- 页脚小字：领养代替购买倡导 + 免责声明链接锚点

### `/quiz` 答题页
- 单题单屏，点击选项自动进下一题，顶部进度条
- 第4/8题后插入微反馈气泡（1.5s 停留动画）
- 答完 POST /api/session → 跳 `/result/[sessionId]`

### `/result/[sessionId]` 免费结果页（转化主战场）
自上而下：
1. 人格揭晓区：称号 + subtitle + verdict（判词），带揭晓动效
2. 本命猫区：品种名 + primaryBreed.reason 一句话
3. **免费分享卡**：展示卡片预览 + "保存图片"按钮（调 /api/card/[id]），无任何付费前置
4. 付费区（气质是"服务升级"而非"解锁封印"）：
   - 标题：`你的完整养猫决策报告已就绪`
   - 内容清单（列出报告5个部分，含"3个缘分猫名"彩蛋预告）
   - freeTeaser 文案展示（夸到一半的那句话放这里，作为报告文风预览）
   - 按钮A：`¥9.9 获取报告` → 新窗口打开 NEXT_PUBLIC_PAY_URL
   - 按钮B：`我已购买，输入兑换码` → 展开输入框 → POST /api/redeem → 成功跳 /report
   - 小字：觉得不准？联系客服免费重测

### `/report/[sessionId]` 报告页
- 校验 session.paid，未付费则重定向回 result
- 报告流式渲染（打字机效果），已有缓存则直接展示
- 底部：保存分享卡按钮（复用）+ 重测入口 + 免责与领养倡导固定文案

### 分享卡（/api/card/[sessionId]，@vercel/og）
1080×1440 竖版，层级：顶部小字品牌名「本命猫鉴定所」→ 大字称号 + subtitle → 本命猫品种名 → 判词（视觉重心，占卡面中部）→ 底部产品短链 + "测测你内心住着哪只猫"。配色取 persona.cardTheme。不放二维码（MVP用短链即可）。

## 7. API规格（全部为 App Router 的 route handler）

| 路由 | 方法 | 职责 |
|---|---|---|
| /api/session | POST | 入参 answers[]；跑计分引擎；写 sessions；返回 sessionId + persona 摘要 |
| /api/redeem | POST | 入参 code + sessionId；事务性校验：码存在且未用 → 标记 used、session.paid=true；对码输入做速率限制（同IP每分钟≤5次）；错误返回统一为"兑换码无效或已使用" |
| /api/report | POST | 入参 sessionId；校验 paid；查 reports 缓存，命中直接返回；未命中则调LLM流式生成，完成后写缓存。设置 max_tokens 上限（约1800）与30s超时重试1次 |
| /api/card/[sessionId] | GET | @vercel/og 生成PNG |
| /api/admin/codes | POST | Header `x-admin-secret` 校验；入参 count；批量生成8位码写库并返回列表（运营者拿去发卡平台配置自动发货） |

## 8. 支付抽象（为Phase 2预留）

`/lib/payment/` 下定义接口：

```ts
interface PaymentProvider {
  getPaymentEntry(sessionId: string): { type: 'redirect' | 'native', url?: string }
  verify(sessionId: string, credential: string): Promise<boolean>
}
```

MVP 实现 `CodeRedemptionProvider`（credential=兑换码）。目录内留 `WechatPayProvider.todo.ts` 空壳与注释，说明未来接官方支付回调时替换点在哪。业务代码只依赖接口。

## 9. LLM调用规范

- 仅服务端；OpenAI兼容SDK，baseURL/model 全走环境变量
- temperature 0.8（文采优先），stream 输出
- 每次调用 console 记录 sessionId + token用量（成本监控的最简形式）
- 同一 session **永不重复生成**（缓存优先），刷新页面不产生二次成本
- Prompt注入防御：用户答案仅以结构化摘要注入，不拼接任何用户自由文本（本产品无自由输入，天然安全，保持这一点）

## 10. 里程碑与验收标准

**M1 工程骨架 + 答题引擎**
- [ ] 项目初始化、schema.sql、/content 数据文件（2真实+占位）、计分引擎+单测
- [ ] 落地页与答题页可完整走通，微反馈正常插入
- 验收：固定答案组合 → 稳定得到同一 persona

**M2 免费结果页 + 分享卡**
- [ ] result 页全部区块；/api/card 出图，中文字体渲染正常，手机长按可保存
- 验收：真机（微信内置浏览器）保存卡片成功

**M3 报告生成**
- [ ] /api/report 流式生成 + 缓存 + 打字机渲染；Prompt模板含全部硬规则
- 验收：同一session刷新不重复计费；报告结构完整含5节与结尾固定文案

**M4 兑换码闭环**
- [ ] admin生成码 → redeem核销 → paid门禁生效 → 报告可达；速率限制生效
- 验收：一码不可二用；未付费直连 /report 被重定向

**M5 打磨上线**
- [ ] 全站loading/错误态、答题动效、SEO与社交分享meta（og:image用示例卡）、移动端真机QA
- 验收：Lighthouse移动端性能≥80；375px无横向滚动

## 11. 交接说明（写入README）

- 运营者如何：替换 /content 内容、生成兑换码、更换LLM供应商、更换收款链接
- 明示：正式上线前须将 personas.json 的占位人格替换为完整10人格矩阵
