import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RedeemBox from "@/components/RedeemBox";
import SiteFooter from "@/components/SiteFooter";
import { personaById } from "@/lib/content";
import { db } from "@/lib/db";
import { paymentProvider } from "@/lib/payment/code-redemption";
import { hasPremiumFlags } from "@/lib/premium";
import { detectBreedConflict } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "我的鉴定结果" };

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

  const conflict = detectBreedConflict(persona, session.hardFlags);
  const payEntry = paymentProvider.getPaymentEntry(sessionId);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-10 px-6 py-10">
      <section className="flex flex-col items-center gap-3 text-center">
        <div className="anim-reveal flex flex-col items-center gap-3">
          <p className="text-xs tracking-[0.4em] text-soft">你的铲屎官人格是</p>
          <h1 className="text-4xl font-bold tracking-wide">{persona.title}</h1>
          <span
            className="rounded-full border px-4 py-1 text-sm"
            style={{ color: persona.cardTheme.accent, borderColor: persona.cardTheme.accent }}
          >
            {persona.subtitle}
          </span>
        </div>
        <p className="anim-fade-up-delay-1 mt-2 text-base leading-relaxed text-ink/80">
          “{persona.verdict}”
        </p>
      </section>

      <section className="anim-fade-up-delay-2 rounded-card bg-white p-6 shadow-sm">
        <p className="text-xs tracking-[0.3em] text-soft">你的本命猫</p>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: persona.cardTheme.accent }}>
          {persona.primaryBreed.name}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/80">{persona.primaryBreed.reason}</p>

        {conflict.hasConflict && conflict.message && (
          <div className="mt-5 rounded-card border border-accent/25 bg-milk p-4">
            <p className="text-xs font-bold tracking-[0.25em] text-accentDeep">现实提示</p>
            <p className="mt-2 text-sm leading-relaxed text-ink/75">“{conflict.message}”</p>
          </div>
        )}
      </section>

      <section className="anim-fade-up-delay-3 flex flex-col items-center gap-4">
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
          className="pressable w-full max-w-xs rounded-full border-2 border-accent py-3 text-center font-bold text-accentDeep"
        >
          保存分享卡
        </a>
        <p className="max-w-xs text-center text-xs leading-relaxed text-soft">
          把卡片发给你的闺蜜——看看你们是谁照顾谁的铲屎官组合。
        </p>
        <p className="text-xs text-soft">手机端可长按上方卡片保存</p>
      </section>

      <RedeemBox
        sessionId={sessionId}
        paid={session.paid}
        hasPremiumCustomization={hasPremiumFlags(session.premiumFlags)}
        payUrl={payEntry.url ?? ""}
        teaser={persona.freeTeaser}
        breedName={persona.primaryBreed.name}
      />

      <SiteFooter />
    </main>
  );
}
