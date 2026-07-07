import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ReportViewer from "@/components/ReportViewer";
import { personaById } from "@/lib/content";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "养猫决策报告" };

export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await db.getSession(sessionId);
  if (!session) redirect("/");
  if (!session.paid) redirect(`/result/${sessionId}`);

  const persona = personaById(session.personaId);
  if (!persona) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-8 px-6 py-10">
      <header className="text-center">
        <p className="text-xs tracking-[0.4em] text-soft">本命猫鉴定所 · 专属报告</p>
        <h1 className="mt-3 text-2xl font-bold">
          {persona.title} × {persona.primaryBreed.name}
        </h1>
        <p className="mt-1 text-sm text-soft">养猫决策报告</p>
      </header>

      <ReportViewer sessionId={sessionId} />

      <section className="flex flex-col items-center gap-4 border-t border-ink/10 pt-8">
        <img
          src={`/api/card/${sessionId}`}
          alt={`${persona.title} 分享卡`}
          width={1080}
          height={1440}
          className="w-full max-w-[240px] rounded-card shadow-lg"
        />
        <a
          href={`/api/card/${sessionId}`}
          download="benmingmao-card.png"
          className="w-full max-w-xs rounded-full border-2 border-accent py-3 text-center font-bold text-accentDeep active:scale-95"
        >
          保存分享卡
        </a>
        <Link href="/quiz" className="text-sm text-soft underline underline-offset-4">
          再测一次
        </Link>
      </section>

      <footer className="space-y-2 pb-4 text-center text-xs leading-relaxed text-soft/80">
        <p>领养代替购买。这些性格特质，田园猫中同样存在。</p>
        <p>本报告为参考建议。若遇到兑换或生成异常，请保留订单截图联系客服处理。</p>
      </footer>
    </main>
  );
}
