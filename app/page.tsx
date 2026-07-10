import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <header className="anim-fade-up text-center text-sm tracking-[0.4em] text-soft">
        本命猫鉴定所
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="anim-fade-up cat-glow" aria-hidden>
          <span className="anim-float text-6xl">🐈</span>
        </div>
        <h1 className="anim-fade-up-delay-1 text-3xl font-bold leading-snug">
          测测你内心
          <br />
          住着哪只猫
        </h1>
        <p className="anim-fade-up-delay-2 text-base leading-relaxed text-soft">
          16 道题，比你自己更懂你适合哪只毛孩子。
          <br />
          帮你在心动养猫之前，先想清楚。
        </p>

        <div className="anim-fade-up-delay-2 rounded-full border border-accent/40 bg-milk px-5 py-2 text-sm font-medium text-accentDeep">
          基础结果免费 · 兑换码解锁专属养猫决策报告
        </div>

        <div className="anim-fade-up-delay-3 mt-2 flex w-full max-w-xs flex-col gap-3">
          <Link
            href="/quiz"
            prefetch
            className="pressable w-full rounded-full bg-accent py-4 text-center text-lg font-bold text-white shadow-lg shadow-accent/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/40"
          >
            开始免费测试
          </Link>
          <Link
            href="/redeem"
            prefetch
            className="pressable w-full rounded-full border border-accent/40 bg-white py-3 text-center text-sm font-bold text-accentDeep hover:-translate-y-0.5 hover:border-accent"
          >
            我已有兑换码
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
