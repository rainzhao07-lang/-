import Link from "next/link";
import { questions } from "@/lib/content";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <header className="anim-fade-up text-center text-sm tracking-[0.4em] text-soft">
        本命猫鉴定所
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="anim-fade-up text-6xl" aria-hidden>
          🐈
        </div>
        <h1 className="anim-fade-up-delay-1 text-3xl font-bold leading-snug">
          测测你内心
          <br />
          住着哪只猫
        </h1>
        <p className="anim-fade-up-delay-2 text-base leading-relaxed text-soft">
          先看基础结果，再用兑换码解锁深度报告。
          <br />
          帮你更冷静地判断自己适合怎样的猫。
        </p>

        <div className="anim-fade-up-delay-2 rounded-full border border-accent/40 bg-milk px-5 py-2 text-sm font-medium text-accentDeep">
          基础结果免费 · 深度报告凭兑换码解锁
        </div>

        <div className="anim-fade-up-delay-3 mt-2 flex w-full max-w-xs flex-col gap-3">
          <Link
            href="/quiz"
            prefetch
            className="w-full rounded-full bg-accent py-4 text-center text-lg font-bold text-white shadow-lg shadow-accent/30 transition active:scale-95"
          >
            开始免费测试
          </Link>
          <Link
            href="/redeem"
            prefetch
            className="w-full rounded-full border border-accent/40 bg-white py-3 text-center text-sm font-bold text-accentDeep active:scale-95"
          >
            我已有兑换码
          </Link>
        </div>

        <p className="anim-fade-up-delay-3 text-xs text-soft">
          {questions.length} 道题 · 约 3 分钟 · 无需注册
        </p>
      </section>

      <footer className="mt-10 space-y-2 text-center text-xs leading-relaxed text-soft/80">
        <p>我们倡导领养代替购买。报告中的性格特质，田园猫中同样存在。</p>
        <p id="disclaimer">
          本测试与报告均为参考建议，不构成任何专业意见；每只猫都是独立的个体。
        </p>
      </footer>
    </main>
  );
}
