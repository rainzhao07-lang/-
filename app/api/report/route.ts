import { NextResponse } from "next/server";
import { personaById, questions } from "@/lib/content";
import { db } from "@/lib/db";
import { generateReportStream, llmModelName } from "@/lib/llm";

export const runtime = "nodejs";

// 单实例内的"生成中"标记:防止同一会话并发触发两次 LLM 计费。
// (Supabase reports 表以 session_id 为主键,即使多实例并发,缓存也只会留一份)
const generating = new Set<string>();

/** POST /api/report — 校验付费 → 缓存优先 → LLM 流式生成并写缓存 */
export async function POST(req: Request) {
  let body: { sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

  const session = await db.getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "测试会话不存在" }, { status: 404 });
  }
  if (!session.paid) {
    return NextResponse.json({ error: "请先解锁报告" }, { status: 403 });
  }

  // 缓存命中:同一会话永不重复生成、永不重复计费(任务书§9)
  const cached = await db.getReport(sessionId);
  if (cached) {
    return new Response(cached.content, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-report-cache": "hit" },
    });
  }

  if (generating.has(sessionId)) {
    return NextResponse.json({ error: "报告正在生成中,请稍候刷新页面" }, { status: 409 });
  }
  generating.add(sessionId);

  const persona = personaById(session.personaId);
  if (!persona) {
    generating.delete(sessionId);
    return NextResponse.json({ error: "人格数据缺失,请联系客服" }, { status: 500 });
  }

  // 答题摘要:服务端由题库文本拼装,不含任何用户自由输入
  const answersSummary = session.answers.map((optionIndex, i) => {
    const q = questions[i];
    const opt = q?.options[optionIndex];
    return q && opt ? `${q.text} → ${opt.text}` : "";
  }).filter(Boolean);

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of generateReportStream({
          sessionId,
          persona,
          answersSummary,
          hardFlags: session.hardFlags,
        })) {
          fullText += delta;
          controller.enqueue(encoder.encode(delta));
        }
        if (fullText.trim().length > 0) {
          await db.saveReport({ sessionId, content: fullText, model: llmModelName() });
        }
        controller.close();
      } catch (err) {
        console.error(`[report] 生成失败 session=${sessionId}:`, err);
        controller.error(err);
      } finally {
        generating.delete(sessionId);
      }
    },
    cancel() {
      generating.delete(sessionId);
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "x-report-cache": "miss" },
  });
}
