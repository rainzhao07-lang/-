"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PENDING_CODE_KEY = "benmingmao.pendingCode";
const MAX_CODE_LENGTH = 16;

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, MAX_CODE_LENGTH);
}

type Props = {
  initialCode?: string;
};

export default function VoucherStart({ initialCode = "" }: Props) {
  const router = useRouter();
  const [code, setCode] = useState(normalizeCode(initialCode));

  function startQuiz() {
    const normalized = normalizeCode(code);
    if (normalized) {
      window.localStorage.setItem(PENDING_CODE_KEY, normalized);
    }
    router.push("/quiz");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <header className="text-center text-sm tracking-[0.35em] text-soft">兑换码入口</header>

      <section className="flex flex-1 flex-col justify-center gap-6">
        <div className="text-center">
          <div className="cat-glow inline-flex" aria-hidden>
            <span className="anim-float text-5xl">🐈</span>
          </div>
          <h1 className="mt-5 text-3xl font-bold leading-snug">
            你的本命猫报告
            <br />
            已预约
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-soft">
            完成测试后，系统会根据你的答案生成专属养猫决策报告。
          </p>
        </div>

        <div className="rounded-card bg-white p-5 shadow-sm">
          <label htmlFor="voucher-code" className="text-sm font-bold text-ink">
            兑换码
          </label>
          <input
            id="voucher-code"
            value={code}
            onChange={(event) => setCode(normalizeCode(event.target.value))}
            maxLength={MAX_CODE_LENGTH}
            placeholder="可先粘贴，或测完再填"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            className="mt-3 w-full rounded-full border border-ink/10 bg-cream px-5 py-3 text-center text-lg tracking-[0.25em] outline-none focus:border-accent"
          />
          <button
            onClick={startQuiz}
            className="pressable mt-4 w-full rounded-full bg-accent py-3.5 font-bold text-white"
          >
            开始生成我的报告
          </button>
        </div>

        <div className="rounded-card border border-accent/20 bg-milk p-4 text-sm leading-relaxed text-ink/75">
          <p className="font-bold text-accentDeep">使用说明</p>
          <p className="mt-2">1. 在商城下单后，复制订单里的兑换码。</p>
          <p>2. 回到这里粘贴兑换码并开始测试。</p>
          {/* TODO(copy): V1.4 未提供“先核销再定制”的入口步骤终稿。 */}
        </div>
      </section>
    </main>
  );
}
