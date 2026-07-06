import { NextResponse } from "next/server";
import { personaById } from "@/lib/content";
import { db } from "@/lib/db";
import { scoreAnswers } from "@/lib/scoring";

export const runtime = "nodejs";

/** POST /api/session — 提交答案,跑计分引擎,创建会话 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const answers = (body as { answers?: unknown })?.answers;

  let result;
  try {
    result = scoreAnswers(answers);
  } catch {
    return NextResponse.json({ error: "答案不完整或不合法" }, { status: 400 });
  }

  const session = await db.createSession({
    answers: answers as number[],
    personaId: result.personaId,
    hardFlags: result.hardFlags,
  });

  const persona = personaById(result.personaId)!;
  return NextResponse.json({
    sessionId: session.id,
    persona: {
      id: persona.id,
      title: persona.title,
      subtitle: persona.subtitle,
      verdict: persona.verdict,
      primaryBreed: persona.primaryBreed,
    },
  });
}
