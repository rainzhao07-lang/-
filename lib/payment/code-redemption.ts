import { db } from "@/lib/db";
import type { PaymentProvider } from "./types";

export class CodeRedemptionProvider implements PaymentProvider {
  getPaymentEntry(_sessionId: string) {
    return { type: "redirect" as const, url: process.env.NEXT_PUBLIC_PAY_URL };
  }

  async verify(sessionId: string, credential: string): Promise<boolean> {
    const code = credential.trim().toUpperCase();
    if (!/^[A-Z0-9]{8,16}$/.test(code)) return false;
    return db.redeemCode(code, sessionId);
  }
}

export const paymentProvider: PaymentProvider = new CodeRedemptionProvider();
