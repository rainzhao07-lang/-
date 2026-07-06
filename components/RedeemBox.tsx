"use client";

// 付费区 + 兑换码输入(任务书§6 result 页第4区块)
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  sessionId: string;
  paid: boolean;
  payUrl: string;
  teaser: string;
  breedName: string;
};

const REPORT_FEATURES = [
  "猫系人格深度剖析(含只属于你的那段话)",
  "为什么是它:本命猫深度分析",
  "另外两只备选品种 + 横向对比",
  "真实脾气、健康雷点、月均花费、新手第一个月清单",
  "彩蛋:AI为你的猫起的3个缘分名字",
];

export default function RedeemBox({ sessionId, paid, payUrl, teaser, breedName }: Props) {
  const router = useRouter();
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (paid) {
    return (
      <section className="anim-fade-up-delay-3 rounded-card bg-ink p-6 text-center text-cream">
        <p className="text-sm">你的报告已解锁</p>
        <button
          onClick={() => router.push(`/report/${sessionId}`)}
          className="mt-4 w-full rounded-full bg-accent py-3 font-bold text-white active:scale-95"
        >
          查看我的养猫决策报告
        </button>
      </section>
    );
  }

  async function redeem() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, sessionId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        router.push(`/report/${sessionId}`);
        return;
      }
      setError(data.error ?? "兑换码无效或已使用");
    } catch {
      setError("网络异常,请重试");
    }
    setPending(false);
  }

  return (
    <section className="anim-fade-up-delay-3 rounded-card bg-ink p-6 text-cream">
      <h3 className="text-lg font-bold">你的完整养猫决策报告已就绪</h3>

      <ul className="mt-4 space-y-2 text-sm leading-relaxed text-cream/85">
        {REPORT_FEATURES.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className="text-accent">
              ✓
            </span>
            <span>{f.replace("它", breedName)}</span>
          </li>
        ))}
      </ul>

      {/* 报告文风预览:夸到一半的那句话 */}
      <blockquote className="mt-5 rounded-xl bg-white/10 p-4 text-sm italic leading-relaxed text-cream/90">
        “{teaser}……”
        <span className="mt-1 block text-right text-xs not-italic text-cream/50">
          —— 报告节选,后面还有 1000 字
        </span>
      </blockquote>

      <div className="mt-6 flex flex-col gap-3">
        {payUrl ? (
          <a
            href={payUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-accent py-3.5 text-center font-bold text-white transition active:scale-95"
          >
            ¥9.9 获取报告
          </a>
        ) : (
          <div className="rounded-full bg-accent/40 py-3.5 text-center text-sm text-white/70">
            收款链接配置中,可先用兑换码解锁
          </div>
        )}

        {!showInput ? (
          <button
            onClick={() => setShowInput(true)}
            className="rounded-full border border-cream/30 py-3 text-sm text-cream/90 active:scale-95"
          >
            我已购买,输入兑换码
          </button>
        ) : (
          <div className="anim-fade-up flex flex-col gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="输入8位兑换码"
              autoFocus
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              className="rounded-full border border-cream/30 bg-white/10 px-5 py-3 text-center text-lg tracking-[0.3em] text-cream placeholder:text-sm placeholder:tracking-normal placeholder:text-cream/40 focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => void redeem()}
              disabled={pending || code.length < 8}
              className="rounded-full bg-accent py-3 font-bold text-white transition active:scale-95 disabled:opacity-50"
            >
              {pending ? "验证中…" : "解锁报告"}
            </button>
            {error && <p className="text-center text-sm text-red-300">{error}</p>}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-cream/50">觉得不准？联系客服免费重测</p>
    </section>
  );
}
