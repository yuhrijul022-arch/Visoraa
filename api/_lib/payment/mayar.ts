import crypto from "crypto";
import { PaymentProvider, CreateTransactionParams, PaymentProviderResult } from "./types.js";

// Mayar Headless API v1
// Production: https://api.mayar.id/hl/v1
// Sandbox:    https://api.mayar.club/hl/v1
const MAYAR_BASE_URL = process.env.MAYAR_BASE_URL || "https://api.mayar.id/hl/v1";

export class MayarProvider implements PaymentProvider {
  private serverKey: string;
  private webhookSecret: string;

  constructor({ serverKey, webhookSecret }: { serverKey: string; webhookSecret: string }) {
    this.serverKey = serverKey;
    this.webhookSecret = webhookSecret;
  }

  async createTransaction(params: CreateTransactionParams): Promise<PaymentProviderResult> {
    const url = `${MAYAR_BASE_URL}/payment/create`;
    const nameStr = params.name || "Visora User";
    const siteUrl = process.env.VITE_SITE_URL || "https://visoraa.vercel.app";

    // Set expiration 24 hours from now in ISO 8601 format
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const body = {
      name: nameStr,
      email: params.email,
      amount: params.amountIdr,
      mobile: "0000000000", // Required by Mayar API, fallback if not provided
      description: `Visora ${params.paymentType} - Order ${params.orderId}`,
      redirectURL: `${siteUrl}/dashboard?payment=success&orderId=${params.orderId}`,
      expiredAt: expiredAt,
    };

    console.log("[Mayar] Creating payment:", { url, orderId: params.orderId, amount: params.amountIdr });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.serverKey}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[Mayar] API error:", response.status, responseText);
      throw new Error(`Mayar API error (${response.status}): ${responseText}`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("[Mayar] Invalid JSON response:", responseText);
      throw new Error(`Mayar returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    console.log("[Mayar] Payment created:", JSON.stringify(data).substring(0, 500));

    // Mayar Headless API v1 response structure:
    // { statusCode: 200, messages: "...", data: { id, link, ... } }
    const paymentData = data.data || data;
    const paymentLink = paymentData.link || paymentData.url || paymentData.paymentLink || "";
    const paymentId = paymentData.id || "";

    if (!paymentLink) {
      console.error("[Mayar] No payment link in response:", JSON.stringify(data));
      throw new Error("Mayar did not return a payment link");
    }

    return {
      token: paymentId,
      orderId: params.orderId,
      redirectUrl: paymentLink,
    };
  }

  async verifyWebhook(payload: any, signature: string): Promise<boolean> {
    // Mayar webhook signature: HMAC SHA256 of the JSON body using webhook secret
    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(payloadString)
      .digest("hex");

    return signature === expectedSignature;
  }
}
