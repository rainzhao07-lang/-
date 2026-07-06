import Link from "next/link";

/** 落地页(任务书§6):立意 + 价格透明 + 开始按钮 */
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
          你的人格猫，就是你该养的那只。
          <br />
          AI帮你3分钟避开冲动养猫的坑。
        </p>

        {/* 价格前置透明:留下的用户全程无被骗感 */}
        <div className="anim-fade-up-delay-2 rounded-full border border-accent/40 bg-milk px-5 py-2 text-sm font-medium text-accentDeep">
          基础结果免费 · 深度报告 ¥9.9
        </div>

        <Link
          href="/quiz"
          className="anim-fade-up-delay-3 mt-2 w-full max-w-xs rounded-full bg-accent py-4 text-center text-lg font-bold text-white shadow-lg shadow-accent/30 transition active:scale-95"
        >
          开始测试
        </Link>
        <p className="anim-fade-up-delay-3 text-xs text-soft">
          12道题 · 约3分钟 · 无需注册
        </p>
      </section>

      <footer className="mt-10 space-y-2 text-center text-xs leading-relaxed text-soft/80">
        <p>我们倡导领养代替购买——报告中的性格特质，田园猫中同样存在。</p>
        <p id="disclaimer">
          本测试与报告均为参考建议，不构成任何专业意见；每只猫都是独立的个体。
        </p>
      </footer>
    </main>
  );
}
