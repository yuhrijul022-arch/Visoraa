import crypto from "crypto";
import { PaymentProvider, CreateTransactionParams, PaymentProviderResult } from "./types";

export class MayarProvider implements PaymentProvider {
  private serverKey: string;
  private webhookSecret: string;

  constructor({ serverKey, webhookSecret }: { serverKey: string; webhookSecret: string }) {
    this.serverKey = serverKey;
    this.webhookSecret = webhookSecret;
  }

  async createTransaction(params: CreateTransactionParams): Promise<PaymentProviderResult> {
    const url = "https://api.mayar.id/hl/v1/payment/create";
    const nameStr = params.name || "Visora User";

    const body = {
      name: nameStr,
      email: params.email,
      amount: params.amountIdr,
      description: `Visora ${params.paymentType}`,
      orderId: params.orderId,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.serverKey}`, // Mayar key format
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Mayar error: ${err}`);
    }

    const data = await response.json();
    
    // Mayar generally returns a shortlink. We return it as redirectUrl
    return {
      token: data.id || "", // Transaction ID if needed
      orderId: params.orderId,
      redirectUrl: data.link, // Used by frontend to redirect the user
    };
  }

  async verifyWebhook(payload: any, signature: string): Promise<boolean> {
    // Mayar webhook signature consists of HMAC SHA256 of the JSON body using webhook secret
    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(payloadString)
      .digest("hex");

    return signature === expectedSignature;
  }
}
