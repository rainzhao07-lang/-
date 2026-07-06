"use client";

// 答题流程(任务书§6):单题单屏、点选自动进题、顶部进度条、
// 第4/8题答完后插入微反馈气泡(纯规则驱动,不调LLM,零成本零延迟)。
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { questions } from "@/lib/content";
import { topPersonaForPartial } from "@/lib/scoring";

const MICRO_FEEDBACK_AFTER = new Set([3, 7]); // 第4题、第8题(0基下标)
const BUBBLE_MS = 1600;

export default function QuizFlow() {
  const router = useRouter();
  const [answers, setAnswers] = useState<number[]>([]);
  const [bubble, setBubble] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockedRef = useRef(false);

  const idx = Math.min(answers.length, questions.length - 1);
  const question = questions[idx];
  const progress = Math.round((answers.length / questions.length) * 100);

  async function submit(finalAnswers: number[]) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { sessionId: string };
      router.replace(`/result/${data.sessionId}`);
    } catch {
      setSubmitting(false);
      lockedRef.current = false;
      setError("提交失败了,请检查网络后重试");
    }
  }

  function handleSelect(optionIndex: number) {
    if (lockedRef.current || submitting) return;
    const next = [...answers, optionIndex];

    const proceed = () => {
      setBubble(null);
      if (next.length === questions.length) {
        void submit(next);
      } else {
        lockedRef.current = false;
        setAnswers(next);
      }
    };

    if (MICRO_FEEDBACK_AFTER.has(answers.length)) {
      // 取当前累计得分最高人格的微反馈语料,随机一句
      lockedRef.current = true;
      setAnswers(next);
      const persona = topPersonaForPartial(next);
      const pool = persona.microFeedbackPool;
      setBubble(pool[Math.floor(Math.random() * pool.length)]);
      window.setTimeout(proceed, BUBBLE_MS);
    } else {
      lockedRef.current = true;
      // 微小延迟让点击态可感知
      window.setTimeout(proceed, 120);
      setAnswers(next);
    }
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-4xl" aria-hidden>
          🙀
        </div>
        <p className="text-soft">{error}</p>
        <button
          onClick={() => void submit(answers)}
          className="rounded-full bg-accent px-8 py-3 font-bold text-white active:scale-95"
        >
          重试
        </button>
      </main>
    );
  }

  if (submitting) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="anim-reveal text-5xl" aria-hidden>
          🐾
        </div>
        <p className="text-lg font-medium">正在鉴定你的本命猫…</p>
        <p className="text-sm text-soft">AI 正在核对 12 道题的每一个细节</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      {/* 进度条 */}
      <div className="mb-2 flex items-center justify-between text-xs text-soft">
        <span>
          {Math.min(answers.length + 1, questions.length)} / {questions.length}
        </span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-milk">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 题目卡片:key 切换触发入场动画 */}
      <section key={question.id} className="anim-fade-up mt-10 flex flex-1 flex-col">
        <h2 className="text-xl font-bold leading-relaxed">{question.text}</h2>
        <div className="mt-8 flex flex-col gap-3">
          {question.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={bubble !== null}
              className="rounded-card border border-ink/10 bg-white px-5 py-4 text-left text-base leading-relaxed shadow-sm transition active:scale-[0.98] active:border-accent active:bg-milk disabled:opacity-60"
            >
              {opt.text}
            </button>
          ))}
        </div>
      </section>

      {/* 微反馈气泡 */}
      {bubble && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 flex justify-center px-8">
          <div className="anim-bubble flex max-w-sm items-start gap-2 rounded-card rounded-bl-sm bg-ink px-5 py-4 text-sm leading-relaxed text-cream shadow-xl">
            <span aria-hidden>🐱</span>
            <span>{bubble}</span>
          </div>
        </div>
      )}
    </main>
  );
}
