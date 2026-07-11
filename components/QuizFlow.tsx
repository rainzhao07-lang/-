"use client";

// 答题流程：单题单屏；第4/8/12题后插入独立微反馈过场。
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { questions } from "@/lib/content";
import { topPersonaForPartial } from "@/lib/scoring";

const MICRO_FEEDBACK_AFTER = new Set([3, 7, 11]); // 第4题、第8题、第12题后显示
const FEEDBACK_MS = 1800;
const PENDING_CODE_KEY = "benmingmao.pendingCode";

export default function QuizFlow() {
  const router = useRouter();
  const [answers, setAnswers] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockedRef = useRef(false);
  const feedbackTimerRef = useRef<number | null>(null);

  const idx = Math.min(answers.length, questions.length - 1);
  const question = questions[idx];
  const progress = Math.round((answers.length / questions.length) * 100);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  function unlockOnNextFrame() {
    window.requestAnimationFrame(() => {
      lockedRef.current = false;
    });
  }

  function finishFeedback() {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    setFeedback(null);
    unlockOnNextFrame();
  }

  function showFeedback(message: string) {
    setFeedback(message);
    feedbackTimerRef.current = window.setTimeout(finishFeedback, FEEDBACK_MS);
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
      if (!pendingCode) {
        router.replace(`/result/${data.sessionId}`);
        return;
      }

      try {
        const redeemRes = await fetch("/api/redeem", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: pendingCode, sessionId: data.sessionId }),
        });
        const redeemData = (await redeemRes.json().catch(() => null)) as { ok?: boolean } | null;
        if (redeemRes.ok && redeemData?.ok) {
          window.localStorage.removeItem(PENDING_CODE_KEY);
          router.replace(`/premium-quiz/${data.sessionId}`);
          return;
        }
      } catch {
        // 会话已经创建，兑换异常时回结果页继续，不重复创建会话。
      }

      router.replace(`/result/${data.sessionId}`);
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
      showFeedback(pool[Math.floor(Math.random() * pool.length)]);
      return;
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
          className="pressable rounded-full bg-accent px-8 py-3 font-bold text-white"
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

  if (feedback) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-8">
        <button
          type="button"
          onClick={finishFeedback}
          aria-label={feedback}
          className="flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-8 text-center"
        >
          <span className="cat-glow anim-float text-7xl" aria-hidden>
            🐱
          </span>
          <span className="anim-reveal text-lg font-medium leading-relaxed text-ink/85">
            {feedback}
          </span>
        </button>
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
          className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[var(--ease-sheet)]"
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
              className="anim-opt pressable rounded-card border border-ink/10 bg-white px-5 py-4 text-left text-base leading-relaxed shadow-sm hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md active:border-accent active:bg-milk disabled:opacity-60"
            >
              {opt.text}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
