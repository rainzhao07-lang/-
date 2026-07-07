import { NextResponse } from "next/server";
import { personaById, questions } from "@/lib/content";
import { db } from "@/lib/db";
import { generateReportStream, llmModelName } from "@/lib/llm";

export const runtime = "nodejs";

/**
 * POST /api/report — 校验付费 → 抢占生成权(落库,跨实例安全)→ LLM 流式生成并写缓存
 *
 * 计费安全设计(Codex review P1 的修复):
 * - 生成锁 = reports 表占位行的原子插入,同一 session 全局只有一个请求能触发 LLM;
 *   其余请求收到 409,由前端轮询等待缓存就绪
 * - 数据库故障一律 503,绝不把故障当"缓存未命中"去调 LLM
 * - 客户端中途断开不中止生成:服务端把流跑完并写缓存,用户刷新即命中缓存
 */
export async function POST(req: Request) {
  let body: { sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  let claim;
  try {
    const session = await db.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "测试会话不存在" }, { status: 404 });
    }
    if (!session.paid) {
      return NextResponse.json({ error: "请先解锁报告" }, { status: 403 });
    }

    claim = await db.claimReportGeneration(sessionId);
    if (claim.status === "cached") {
      return new Response(claim.report.content, {
        headers: { "content-type": "text/plain; charset=utf-8", "x-report-cache": "hit" },
      });
    }
    if (claim.status === "pending") {
      return NextResponse.json({ error: "报告正在生成中,请稍候" }, { status: 409 });
    }

    // status === "claimed":本请求拿到生成权
    const persona = personaById(session.personaId);
    if (!persona) {
      await db.releaseReportClaim(sessionId);
      return NextResponse.json({ error: "人格数据缺失,请联系客服" }, { status: 500 });
    }

    // 答题摘要:服务端由题库文本拼装,不含任何用户自由输入
    const answersSummary = session.answers
      .map((optionIndex, i) => {
        const q = questions[i];
        const opt = q?.options[optionIndex];
        return q && opt ? `${q.text} → ${opt.text}` : "";
      })
      .filter(Boolean);

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullText = "";
        let clientGone = false;
        try {
          for await (const delta of generateReportStream({
            sessionId,
            persona,
            answersSummary,
            hardFlags: session.hardFlags,
          })) {
            fullText += delta;
            if (!clientGone) {
              try {
                controller.enqueue(encoder.encode(delta));
              } catch {
                // 客户端已断开:停止推送,但继续消费生成器直至完成并写缓存,
                // 避免"断流→缓存缺失→刷新→再次计费"
                clientGone = true;
              }
            }
          }
          if (fullText.trim().length > 0) {
            await db.finishReport({ sessionId, content: fullText, model: llmModelName() });
          } else {
            await db.releaseReportClaim(sessionId);
          }
          if (!clientGone) {
            try {
              controller.close();
            } catch {
              /* 已被取消 */
            }
          }
        } catch (err) {
          console.error(`[report] 生成失败 session=${sessionId}:`, err);
          await db.releaseReportClaim(sessionId);
          if (!clientGone) {
            try {
              controller.error(err);
            } catch {
              /* 已被取消 */
            }
          }
        }
      },
      // cancel 故意留空:断流后的清理由 start 内部统一处理(继续生成并落缓存)
      cancel() {},
    });

    return new Response(stream, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-report-cache": "miss" },
    });
  } catch (err) {
    // 数据库/基础设施错误:如实 503,绝不静默降级成重复生成
    console.error(`[report] 基础设施错误 session=${sessionId}:`, err);
    return NextResponse.json({ error: "服务暂时不可用,请稍后重试" }, { status: 503 });
  }
}
