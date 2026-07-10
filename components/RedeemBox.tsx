"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  sessionId: string;
  paid: boolean;
  hasPremiumCustomization: boolean;
  payUrl: string;
  teaser: string;
  breedName: string;
};

const PENDING_CODE_KEY = "benmingmao.pendingCode";
const MAX_CODE_LENGTH = 16;

const REPORT_FEATURES = [
  "猫系人格深度解析，写出你为什么会被这种猫吸引",
  "你的本命猫为什么是它，以及真实相处时要注意什么",
  "两只备选猫品种横向对比，避免只凭颜值冲动选择",
  "掉毛、空间、预算、医疗风险、新手第一个月清单",
  "根据你的答案生成更贴近本人的养猫决策建议",
];

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, MAX_CODE_LENGTH);
}

export default function RedeemBox({
  sessionId,
  paid,
  hasPremiumCustomization,
  payUrl,
  teaser,
  breedName,
}: Props) {
  const router = useRouter();
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(PENDING_CODE_KEY);
    if (!saved) return;
    setCode(normalizeCode(saved));
    setShowInput(true);
  }, []);

  if (paid) {
    return (
      <section className="anim-fade-up-delay-3 rounded-card bg-ink p-6 text-center text-cream">
        <p className="text-sm">
          {hasPremiumCustomization ? "你的深度报告已解锁" : "还差一步定制问题"}
        </p>
        <button
          onClick={() => router.push(hasPremiumCustomization ? `/report/${sessionId}` : `/premium-quiz/${sessionId}`)}
          className="pressable mt-4 w-full rounded-full bg-accent py-3 font-bold text-white"
        >
          {hasPremiumCustomization ? "查看我的养猫决策报告" : "完成定制问题"}
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
        window.localStorage.removeItem(PENDING_CODE_KEY);
        router.push(hasPremiumCustomization ? `/report/${sessionId}` : `/premium-quiz/${sessionId}`);
        return;
      }

      setError(data.error ?? "兑换码无效或已使用");
    } catch {
      setError("网络异常，请稍后重试");
    }

    setPending(false);
  }

  return (
    <section className="anim-fade-up-delay-3 rounded-card bg-ink p-6 text-cream">
      <h3 className="text-lg font-bold">你的完整养猫决策报告已准备好</h3>
      <p className="mt-2 text-sm leading-relaxed text-cream/70">
        输入商城订单里的兑换码，即可生成和保存专属报告。
      </p>

      <ul className="mt-4 space-y-2 text-sm leading-relaxed text-cream/85">
        {REPORT_FEATURES.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span aria-hidden className="text-accent">
              ✓
            </span>
            <span>{feature.replace("它", breedName)}</span>
          </li>
        ))}
      </ul>

      <blockquote className="mt-5 rounded-xl bg-white/10 p-4 text-sm italic leading-relaxed text-cream/90">
        “{teaser}……”
        <span className="mt-1 block text-right text-xs not-italic text-cream/50">
          - 报告节选
        </span>
      </blockquote>

      <div className="mt-6 flex flex-col gap-3">
        {payUrl ? (
          <a
            href={payUrl}
            target="_blank"
            rel="noreferrer"
            className="pressable rounded-full bg-accent py-3.5 text-center font-bold text-white"
          >
            去商城获取兑换码
          </a>
        ) : (
          <div className="rounded-card bg-white/10 px-4 py-3 text-center text-sm leading-relaxed text-cream/70">
            已购买的用户可直接输入兑换码；未购买请回到购买渠道获取。
          </div>
        )}

        {!showInput ? (
          <button
            onClick={() => setShowInput(true)}
            className="pressable rounded-full border border-cream/30 py-3 text-sm text-cream/90"
          >
            我已有兑换码
          </button>
        ) : (
          <div className="anim-fade-up flex flex-col gap-2">
            <input
              value={code}
              onChange={(event) => {
                setCode(normalizeCode(event.target.value));
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && code.length >= 8) void redeem();
              }}
              maxLength={MAX_CODE_LENGTH}
              placeholder="输入12位兑换码"
              autoFocus
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="one-time-code"
              className="rounded-full border border-cream/30 bg-white/10 px-5 py-3 text-center text-lg tracking-[0.25em] text-cream placeholder:text-sm placeholder:tracking-normal placeholder:text-cream/40 focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => void redeem()}
              disabled={pending || code.length < 8}
              className="pressable rounded-full bg-accent py-3 font-bold text-white disabled:opacity-50"
            >
              {pending ? "验证中..." : "解锁报告"}
            </button>
            {error && <p className="text-center text-sm text-red-300">{error}</p>}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-cream/50">
        兑换码只用于解锁一次深度报告。若遇到异常，请保留订单截图联系客服处理。
      </p>
    </section>
  );
}
