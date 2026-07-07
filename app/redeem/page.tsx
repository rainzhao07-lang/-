import type { Metadata } from "next";
import VoucherStart from "@/components/VoucherStart";

export const metadata: Metadata = {
  title: "兑换码入口",
};

export default async function RedeemEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  return <VoucherStart initialCode={params.code ?? ""} />;
}
