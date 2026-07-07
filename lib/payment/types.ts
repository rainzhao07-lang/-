export type PaymentEntry = {
  type: "redirect" | "native";
  url?: string;
};

export interface PaymentProvider {
  getPaymentEntry(sessionId: string): PaymentEntry;
  verify(sessionId: string, credential: string): Promise<boolean>;
}
