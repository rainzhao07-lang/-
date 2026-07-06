// 支付抽象(任务书§8)。业务代码只依赖此接口;
// Phase 2 接微信支付/支付宝官方回调时,新增 Provider 实现并在 index.ts 替换导出即可。
export type PaymentEntry = {
  type: "redirect" | "native";
  /** redirect 型的站外收款页地址 */
  url?: string;
};

export interface PaymentProvider {
  /** 获取支付入口(MVP: 跳转面包多/发卡网商品页) */
  getPaymentEntry(sessionId: string): PaymentEntry;
  /** 校验支付凭证(MVP: credential = 兑换码),成功则将 session 标记为已付费 */
  verify(sessionId: string, credential: string): Promise<boolean>;
}
