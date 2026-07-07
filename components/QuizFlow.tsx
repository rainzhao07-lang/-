"use client";

// 答题流程：单题单屏、点选后立即切题，微反馈只作为轻提示，不阻塞继续作答。
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { questions } from "@/lib/content";
import { topPersonaForPartial } from "@/lib/scoring";

const MICRO_FEEDBACK_AFTER = new Set([3, 7, 11]); // 第4题、第8题、第12题后显示
const BUBBLE_MS = 1100;
const PENDING_CODE_KEY = "benmingmao.pendingCode";

export default function QuizFlow() {
  const router = useRouter();
  const [answers, setAnswers] = useState<number[]>([]);
  const [bubble, setBubble] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockedRef = useRef(false);
  const bubbleTimerRef = useRef<number | null>(null);

  const idx = Math.min(answers.length, questions.length - 1);
  const question = questions[idx];
  const progress = Math.round((answers.length / questions.length) * 100);

  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
      }
    };
  }, []);

  function unlockOnNextFrame() {
    window.requestAnimationFrame(() => {
      lockedRef.current = false;
    });
  }

  function showBubble(message: string) {
    if (bubbleTimerRef.current !== null) {
      window.clearTimeout(bubbleTimerRef.current);
    }

    setBubble(message);
    bubbleTimerRef.current = window.setTimeout(() => {
      setBubble(null);
      bubbleTimerRef.current = null;
    }, BUBBLE_MS);
  }

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
      const pendingCode = window.localStorage.getItem(PENDING_CODE_KEY);
      router.replace(pendingCode ? `/premium-quiz/${data.sessionId}` : `/result/${data.sessionId}`);
    } catch {
      setSubmitting(false);
      lockedRef.current = false;
      setError("提交失败了，请检查网络后重试");
    }
  }

  function handleSelect(optionIndex: number) {
    if (lockedRef.current || submitting) return;
    lockedRef.current = true;

    const next = [...answers, optionIndex];
    setAnswers(next);

    if (MICRO_FEEDBACK_AFTER.has(answers.length)) {
      const persona = topPersonaForPartial(next);
      const pool = persona.microFeedbackPool;
      showBubble(pool[Math.floor(Math.random() * pool.length)]);
    }

    if (next.length === questions.length) {
      void submit(next);
      return;
    }

    unlockOnNextFrame();
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
        <p className="text-lg font-medium">正在鉴定你的本命猫...</p>
        <p className="text-sm text-soft">
          系统正在核对 {questions.length} 道题的每一个细节
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      <div className="mb-2 flex items-center justify-between text-xs text-soft">
        <span>
          {Math.min(answers.length + 1, questions.length)} / {questions.length}
        </span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-milk">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* key=question.id:每换一题就重挂载,重新触发进场动画,消除硬切 */}
      <section key={question.id} className="anim-q mt-10 flex flex-1 flex-col">
        <h2 className="text-xl font-bold leading-relaxed">{question.text}</h2>
        <div className="mt-8 flex flex-col gap-3">
          {question.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={submitting}
              style={{ animationDelay: `${0.08 + i * 0.055}s` }}
              className="anim-opt rounded-card border border-ink/10 bg-white px-5 py-4 text-left text-base leading-relaxed shadow-sm transition duration-150 ease-out hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md active:scale-[0.98] active:border-accent active:bg-milk disabled:opacity-60"
            >
              {opt.text}
            </button>
          ))}
        </div>
      </section>

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
