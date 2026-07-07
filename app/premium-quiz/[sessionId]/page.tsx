import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PremiumQuizFlow from "@/components/PremiumQuizFlow";
import { db } from "@/lib/db";
import { canGeneratePaidReport } from "@/lib/premium";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "付费定制问题" };

export default async function PremiumQuizPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await db.getSession(sessionId);
  if (!session) redirect("/");
  if (canGeneratePaidReport(session)) redirect(`/report/${sessionId}`);

  return (
    <PremiumQuizFlow
      sessionId={sessionId}
      paid={session.paid}
      initialAnswers={session.premiumAnswers}
    />
  );
}
