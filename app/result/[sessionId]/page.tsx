import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RedeemBox from "@/components/RedeemBox";
import { personaById } from "@/lib/content";
import { db } from "@/lib/db";
import { paymentProvider } from "@/lib/payment/code-redemption";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "我的鉴定结果" };

/** 免费结果页(任务书§6):转化主战场。免费层完整且体面,付费区气质是"服务升级"。 */
export default async function ResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await db.getSession(sessionId);
  if (!session) redirect("/");
  const persona = personaById(session.personaId);
  if (!persona) redirect("/");
  // 支付入口统一走抽象层:Phase 2 换官方支付时页面不动
  const payEntry = paymentProvider.getPaymentEntry(sessionId);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-10 px-6 py-10">
      {/* ① 人格揭晓区 */}
      <section className="anim-reveal flex flex-col items-center gap-3 text-center">
        <p className="text-xs tracking-[0.4em] text-soft">你的铲屎官人格是</p>
        <h1 className="text-4xl font-bold tracking-wide">{persona.title}</h1>
        <span
          className="rounded-full border px-4 py-1 text-sm"
          style={{ color: persona.cardTheme.accent, borderColor: persona.cardTheme.accent }}
        >
          {persona.subtitle}
        </span>
        <p className="mt-2 text-base leading-relaxed text-ink/80">「{persona.verdict}」</p>
      </section>

      {/* ② 本命猫区 */}
      <section className="anim-fade-up-delay-1 rounded-card bg-white p-6 shadow-sm">
        <p className="text-xs tracking-[0.3em] text-soft">你的本命猫</p>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: persona.cardTheme.accent }}>
          {persona.primaryBreed.name}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/80">{persona.primaryBreed.reason}</p>
      </section>

      {/* ③ 免费分享卡:无任何付费前置 */}
      <section className="anim-fade-up-delay-2 flex flex-col items-center gap-4">
        <img
          src={`/api/card/${sessionId}`}
          alt={`${persona.title} 分享卡`}
          width={1080}
          height={1440}
          className="w-full max-w-xs rounded-card shadow-lg"
        />
        <a
          href={`/api/card/${sessionId}`}
          download="benmingmao-card.png"
          className="w-full max-w-xs rounded-full border-2 border-accent py-3 text-center font-bold text-accentDeep transition active:scale-95"
        >
          保存分享卡
        </a>
        <p className="text-xs text-soft">手机端可直接长按上方卡片保存</p>
      </section>

      {/* ④ 付费区:服务升级,而非解锁封印 */}
      <RedeemBox
        sessionId={sessionId}
        paid={session.paid}
        payUrl={payEntry.url ?? ""}
        teaser={persona.freeTeaser}
        breedName={persona.primaryBreed.name}
      />

      <footer className="space-y-2 pb-4 text-center text-xs leading-relaxed text-soft/80">
        <p>领养代替购买——这些性格特质，田园猫中同样存在。</p>
        <p>本结果为参考建议，每只猫都是独立的个体。</p>
      </footer>
    </main>
  );
}
