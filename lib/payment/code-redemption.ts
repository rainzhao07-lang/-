import { db } from "@/lib/db";
import type { PaymentProvider } from "./types";

/** MVP 支付实现:站外持牌平台收款 + 兑换码核销 */
export class CodeRedemptionProvider implements PaymentProvider {
  getPaymentEntry(_sessionId: string) {
    return { type: "redirect" as const, url: process.env.NEXT_PUBLIC_PAY_URL };
  }

  async verify(sessionId: string, credential: string): Promise<boolean> {
    const code = credential.trim().toUpperCase();
    // 码格式:8位大写字母数字(生成端排除了易混淆字符)
    if (!/^[A-Z0-9]{8}$/.test(code)) return false;
    return db.redeemCode(code, sessionId);
  }
}

export const paymentProvider: PaymentProvider = new CodeRedemptionProvider();
