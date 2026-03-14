import crypto from "crypto";
import { PaymentProvider, CreateTransactionParams, PaymentProviderResult } from "./types.js";

// Mayar Headless API v1
// Docs: https://docs.mayar.id
// Production: https://api.mayar.id/hl/v1
// Sandbox:    https://api.mayar.club/hl/v1

export class MayarProvider implements PaymentProvider {
  private serverKey: string;
  private webhookSecret: string;
  private baseUrl: string;

  constructor({ serverKey, webhookSecret }: { serverKey?: string; webhookSecret?: string }) {
    // Determine the active key and API URL from Vercel env
    this.serverKey = process.env.MAYAR_API_KEY || serverKey || "";
    this.webhookSecret = process.env.MAYAR_WEBHOOK_SECRET || webhookSecret || "";
    this.baseUrl = process.env.MAYAR_API_URL || "https://api.mayar.id/hl/v1";

    if (!this.serverKey) {
      throw new Error("Missing MAYAR_API_KEY in environment variables. Harap pastikan variabel Vercel process.env.MAYAR_API_KEY sudah diisi.");
    }
  }

  async createTransaction(params: CreateTransactionParams): Promise<PaymentProviderResult> {
    const url = `${this.baseUrl}/payment/create`;
    const nameStr = params.name || "Visora User";
    const siteUrl = process.env.VITE_SITE_URL || "https://visoraa.vercel.app";

    // Set expiration 24 hours from now
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const body = {
      name: nameStr,
      email: params.email,
      amount: params.amountIdr,
      mobile: "0000000000",
      description: params.description || `Visora ${params.paymentType} - Order ${params.orderId}`,
      redirectURL: `${siteUrl}/payment/waiting?orderId=${params.orderId}`,
      expiredAt: expiredAt,
    };

    console.log("[Mayar] Creating payment:", JSON.stringify({ url, body }, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // process.env.MAYAR_API_KEY usually contains 'Bearer <token>' or similar based on user requirements.
        // User requested: Gunakan variabel process.env.MAYAR_API_KEY untuk API Key (dengan format Bearer <token>).
        Authorization: this.serverKey.startsWith("Bearer ") ? this.serverKey : `Bearer ${this.serverKey}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log("[Mayar] Response status:", response.status);
    console.log("[Mayar] Response body:", responseText.substring(0, 1000));

    if (!response.ok) {
      console.error("[Mayar] API error:", response.status, responseText);
      throw new Error(`Mayar API error (${response.status}): ${responseText.substring(0, 500)}`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("[Mayar] Invalid JSON response:", responseText);
      throw new Error(`Mayar returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    console.log("[Mayar] Parsed response:", JSON.stringify(data, null, 2).substring(0, 1000));

    // Mayar Headless API v1 response structure:
    // { statusCode: 200, messages: "...", data: { id, link, ... } }
    const paymentData = data.data || data;
    const paymentLink = paymentData.link || paymentData.url || paymentData.paymentLink || paymentData.shortLink || "";
    const paymentId = paymentData.id || "";

    if (!paymentLink) {
      console.error("[Mayar] No payment link in response:", JSON.stringify(data));
      throw new Error("Mayar did not return a payment link. Full response: " + JSON.stringify(data).substring(0, 500));
    }

    console.log("[Mayar] Payment link:", paymentLink);

    return {
      token: paymentId,
      orderId: params.orderId,
      redirectUrl: paymentLink,
    };
  }

  async verifyWebhook(payload: any, signature: string): Promise<boolean> {
    // 1. Static Token Check
    // Mayar Headless API often sends the Webhook Secret directly as a static 'x-callback-token'
    if (signature === this.webhookSecret) {
        return true;
    }

    // 2. HMAC-SHA256 Check
    // Other endpoints may send an actual HMAC hash of the payload in 'mayar-signature'
    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(payloadString)
      .digest("hex");

    return signature === expectedSignature;
  }
}
