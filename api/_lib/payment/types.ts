export type PaymentType = "plan" | "topup" | "infinite_extend";
export type PlanType = "basic" | "pro";

export interface CreateTransactionParams {
  userId: string;
  orderId: string;
  email: string;
  name: string;
  amountIdr: number;
  paymentType: PaymentType;
  creditsQty?: number;
  planType?: PlanType;
  redirectPath?: string;
  description?: string;
}

export interface PaymentProviderResult {
  token: string;
  orderId: string;
  redirectUrl?: string; // Mayar provides payment links
}

export interface PaymentProvider {
  createTransaction(params: CreateTransactionParams): Promise<PaymentProviderResult>;
  verifyWebhook(payload: any, signature: string): Promise<boolean>;
}
