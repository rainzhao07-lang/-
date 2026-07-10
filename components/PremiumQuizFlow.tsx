"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { premiumQuestions } from "@/lib/content";

const PENDING_CODE_KEY = "benmingmao.pendingCode";

type Props = {
  sessionId: string;
  paid: boolean;
  initialAnswers?: number[] | null;
};

export default function PremiumQuizFlow({ sessionId, paid, initialAnswers }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<number[]>(
    Array.isArray(initialAnswers) ? initialAnswers.slice(0, premiumQuestions.length) : [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResultFallback, setShowResultFallback] = useState(false);
  const lockedRef = useRef(false);

  const idx = Math.min(answers.length, premiumQuestions.length - 1);
  const question = premiumQuestions[idx];
  const progress = Math.round((answers.length / premiumQuestions.length) * 100);

  function unlockOnNextFrame() {
    window.requestAnimationFrame(() => {
      lockedRef.current = false;
    });
  }

  async function saveAndContinue(finalAnswers: number[]) {
    setSubmitting(true);
    setError(null);
    setShowResultFallback(false);

    try {
      const saveRes = await fetch("/api/session/premium", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, premiumAnswers: finalAnswers }),
      });
      const saveData = (await saveRes.json().catch(() => null)) as { error?: string } | null;
      if (!saveRes.ok) {
        throw new Error(saveData?.error ?? "定制题保存失败");
      }

      if (paid) {
        router.replace(`/report/${sessionId}`);
        return;
      }

      const code = window.localStorage.getItem(PENDING_CODE_KEY);
      if (!code) {
        setError("定制问题已保存。请返回结果页输入兑换码后继续生成报告。");
        setShowResultFallback(true);
        setSubmitting(false);
        lockedRef.current = false;
        return;
      }

      const redeemRes = await fetch("/api/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, sessionId }),
      });
      const redeemData = (await redeemRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!redeemRes.ok || !redeemData?.ok) {
        setError(redeemData?.error ?? "兑换码无效或已使用，请返回结果页重新输入。");
        setShowResultFallback(true);
        setSubmitting(false);
        lockedRef.current = false;
        return;
      }

      window.localStorage.removeItem(PENDING_CODE_KEY);
      router.replace(`/report/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "定制题保存失败，请检查网络后重试");
      setSubmitting(false);
      lockedRef.current = false;
    }
  }

  function handleSelect(optionIndex: number) {
    if (lockedRef.current || submitting) return;
    lockedRef.current = true;

    const next = [...answers, optionIndex];
    setAnswers(next);

    if (next.length === premiumQuestions.length) {
      void saveAndContinue(next);
      return;
    }

    unlockOnNextFrame();
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-4xl" aria-hidden>
          🐾
        </div>
        <p className="text-sm leading-relaxed text-soft">{error}</p>
        <button
          onClick={() => void saveAndContinue(answers)}
          disabled={answers.length !== premiumQuestions.length || submitting}
          className="pressable w-full max-w-xs rounded-full bg-accent px-8 py-3 font-bold text-white disabled:opacity-50"
        >
          {submitting ? "处理中..." : "重试"}
        </button>
        {showResultFallback && (
          <button
            onClick={() => router.replace(`/result/${sessionId}`)}
            className="pressable w-full max-w-xs rounded-full border border-ink/15 px-8 py-3 text-sm font-bold text-ink/80"
          >
            返回结果页输入兑换码
          </button>
        )}
      </main>
    );
  }

  if (submitting) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="anim-reveal text-5xl" aria-hidden>
          🐈
        </div>
        <p className="text-lg font-medium">正在保存你的定制信息...</p>
        <p className="text-sm text-soft">完成后会自动解锁并生成深度报告</p>
      </main>
    );
  }

  if (answers.length === premiumQuestions.length) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="text-5xl" aria-hidden>
          🐱
        </div>
        <h1 className="text-2xl font-bold">定制问题已完成</h1>
        <p className="text-sm leading-relaxed text-soft">
          你的深度报告信息已经准备好，继续后会校验兑换码并生成报告。
        </p>
        <button
          onClick={() => void saveAndContinue(answers)}
          className="pressable w-full max-w-xs rounded-full bg-accent px-8 py-3 font-bold text-white"
        >
          继续生成报告
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      <header className="mb-6 text-center">
        <p className="text-xs tracking-[0.35em] text-soft">付费定制问题</p>
        <h1 className="mt-3 text-2xl font-bold">让报告更像写给你本人</h1>
        <p className="mt-2 text-sm leading-relaxed text-soft">
          这些问题只用于生成养猫决策报告，不会展示给其他用户。
        </p>
      </header>

      <div className="mb-2 flex items-center justify-between text-xs text-soft">
        <span>
          {Math.min(answers.length + 1, premiumQuestions.length)} / {premiumQuestions.length}
        </span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-milk">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[var(--ease-sheet)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <section key={question.id} className="anim-q mt-10 flex flex-1 flex-col">
        <h2 className="text-xl font-bold leading-relaxed">{question.text}</h2>
        {question.helper && <p className="mt-3 text-sm leading-relaxed text-soft">{question.helper}</p>}
        <div className="mt-8 flex flex-col gap-3">
          {question.options.map((opt, i) => (
            <button
              key={opt.value}
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
