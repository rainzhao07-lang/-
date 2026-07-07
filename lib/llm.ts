import OpenAI from "openai";
import { buildReportMessages } from "@/content/prompts";
import type { BreedConflict, BreedProfile, HardFlags, Persona } from "./types";

const MAX_TOKENS = 1800;
const FIRST_TOKEN_TIMEOUT_MS = 30_000;

export type ReportInput = {
  sessionId: string;
  persona: Persona;
  answersSummary: string[];
  hardFlags: HardFlags;
  breedFacts?: BreedProfile;
  conflict?: BreedConflict;
};

export function llmModelName(): string {
  return process.env.LLM_MODEL ?? "unconfigured";
}

export async function* generateReportStream(input: ReportInput): AsyncGenerator<string> {
  if (!process.env.LLM_API_KEY) {
    throw new Error("报告服务暂时不可用，请联系客服处理");
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
      if (yielded || attempt === 1) throw err;
      console.warn(`[LLM] first attempt failed, retrying session=${input.sessionId}:`, err);
    }
  }
}

async function* attemptStream(input: ReportInput): AsyncGenerator<string> {
  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
  });

  const { system, user } = buildReportMessages(
    input.persona,
    input.answersSummary,
    input.hardFlags,
    input.breedFacts,
    input.conflict,
  );

  const controller = new AbortController();
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
      temperature: 0.8,
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
    console.log(
      `[LLM] session=${input.sessionId} model=${llmModelName()} ` +
        `promptTokens=${usage?.prompt_tokens ?? "?"} completionTokens=${usage?.completion_tokens ?? "?"}`,
    );
  }
}
