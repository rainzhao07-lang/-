// LLM 调用层。只在服务端使用;baseURL/model/key 全走环境变量(默认对接 DeepSeek)。
// 未配置 LLM_API_KEY 时进入 mock 模式:流式输出一份结构完整的假报告,
// 用于本地端到端验证,不产生任何费用(启动时打印警告,生产环境务必配置真实 key)。
import OpenAI from "openai";
import { buildReportMessages } from "@/content/prompts";
import type { HardFlags, Persona } from "./types";

const MAX_TOKENS = 1800;
const FIRST_TOKEN_TIMEOUT_MS = 30_000;

export type ReportInput = {
  sessionId: string;
  persona: Persona;
  answersSummary: string[];
  hardFlags: HardFlags;
};

export function llmModelName(): string {
  return process.env.LLM_API_KEY ? (process.env.LLM_MODEL ?? "deepseek-chat") : "mock";
}

/**
 * 流式生成报告正文。
 * 重试策略(任务书§7):30s 内拿不到首个 token 视为超时;
 * 在还没有向调用方吐出任何内容之前失败,则整体重试1次。
 */
export async function* generateReportStream(input: ReportInput): AsyncGenerator<string> {
  if (!process.env.LLM_API_KEY) {
    console.warn(`[LLM] mock 模式生成报告 session=${input.sessionId}(未配置 LLM_API_KEY)`);
    yield* mockReportStream(input);
    return;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    let yielded = false;
    try {
      for await (const delta of attemptStream(input)) {
        yielded = true;
        yield delta;
      }
      return;
    } catch (err) {
      // 已经吐出过内容就无法干净重试,直接抛给调用方
      if (yielded || attempt === 1) throw err;
      console.warn(`[LLM] 首次调用失败,重试一次 session=${input.sessionId}:`, err);
    }
  }
}

async function* attemptStream(input: ReportInput): AsyncGenerator<string> {
  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
  });
  const { system, user } = buildReportMessages(input.persona, input.answersSummary, input.hardFlags);

  const controller = new AbortController();
  // 30s 拿不到首个 token 判超时;拿到后取消计时,让长文生成自然完成
  let firstTokenTimer: ReturnType<typeof setTimeout> | null = setTimeout(
    () => controller.abort(new Error("LLM_FIRST_TOKEN_TIMEOUT")),
    FIRST_TOKEN_TIMEOUT_MS,
  );

  const stream = await client.chat.completions.create(
    {
      model: process.env.LLM_MODEL ?? "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.8, // 文采优先
      max_tokens: MAX_TOKENS,
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal: controller.signal },
  );

  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
  try {
    for await (const chunk of stream) {
      if (firstTokenTimer) {
        clearTimeout(firstTokenTimer);
        firstTokenTimer = null;
      }
      if (chunk.usage) usage = chunk.usage;
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  } finally {
    if (firstTokenTimer) clearTimeout(firstTokenTimer);
    // 成本监控的最简形式:每次真实调用记录 session 与 token 用量
    console.log(
      `[LLM] session=${input.sessionId} model=${llmModelName()} ` +
        `promptTokens=${usage?.prompt_tokens ?? "?"} completionTokens=${usage?.completion_tokens ?? "?"}`,
    );
  }
}

// ---------- mock 报告(仅本地开发) ----------

async function* mockReportStream(input: ReportInput): AsyncGenerator<string> {
  const { persona, hardFlags } = input;
  const text = [
    `## 你的猫系人格`,
    ``,
    `【本地 mock 报告,仅用于开发验证。配置 LLM_API_KEY 后此处为 AI 实时生成。】`,
    ``,
    `你是「${persona.title}」——${persona.subtitle}。${persona.freeTeaser}别人只看到你的表面节奏,却很少有人发现:你把最柔软的部分收得很深,只留给值得的人和事。这不是防备,是你对"在乎"二字的珍重。`,
    ``,
    `## 为什么是${persona.primaryBreed.name}`,
    ``,
    `${persona.primaryBreed.reason}它和你的生活方式高度契合:${Object.keys(hardFlags).length > 0 ? "从你的作息与空间条件看,它的性格恰好接得住你的节奏。" : "它的性格恰好接得住你的节奏。"}`,
    ``,
    `## 两只备选`,
    ``,
    ...persona.altBreeds.map((b) => `- **${b.name}**:${b.reason}`),
    ``,
    `## 真实养育须知`,
    ``,
    `- 性格真相:再匹配的品种也有脾气,前两周的磨合期请多些耐心;`,
    `- 健康注意:定期驱虫疫苗,留意品种常见的遗传性问题;`,
    `- 月均花费:通常在数百元区间,丰俭由人;`,
    `- 第一个月清单:猫粮、猫砂与砂盆、航空箱、指甲剪、玩具若干、一次基础体检。`,
    ``,
    `## 彩蛋:三个缘分名字`,
    ``,
    `1. 「阿暖」——愿它把你家变成冬天里的暖炉;`,
    `2. 「知秋」——一叶知秋,它总能第一个察觉你的情绪;`,
    `3. 「小满」——小满未满,是生活最好的状态。`,
    ``,
    `---`,
    ``,
    `最后想说:这些性格特质在田园猫中同样存在,领养代替购买,你的本命猫也许正在某个救助站等你。本报告为参考建议,每只猫都是独立的个体,请带着尊重与耐心认识它。`,
  ].join("\n");

  // 按小块吐出,模拟真实流式节奏,前端打字机效果可见
  const CHUNK = 8;
  for (let i = 0; i < text.length; i += CHUNK) {
    yield text.slice(i, i + CHUNK);
    await new Promise((r) => setTimeout(r, 12));
  }
}
