import { createHash } from "crypto";
import { PaymentProvider, CreateTransactionParams, PaymentProviderResult } from "./types";

export class MidtransProvider implements PaymentProvider {
  private isProd: boolean;
  private serverKey: string;

  constructor() {
    this.isProd = process.env.MIDTRANS_IS_PROD === "true";
    this.serverKey = this.isProd
      ? process.env.MIDTRANS_SERVER_KEY_PROD || process.env.MIDTRANS_SERVER_KEY!
      : process.env.MIDTRANS_SERVER_KEY_SANDBOX || process.env.MIDTRANS_SERVER_KEY!;
  }

  async createTransaction(params: CreateTransactionParams): Promise<PaymentProviderResult> {
    const midtransBaseUrl = this.isProd
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const midtransAuth = Buffer.from(`${this.serverKey}:`).toString("base64");
    
    // For Midtrans, if Name is missing we provide a fallback
    const firstName = params.name || "Visora User";

    const snapResponse = await fetch(midtransBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${midtransAuth}`,
      },
      body: JSON.stringify({
        transaction_details: { order_id: params.orderId, gross_amount: params.amountIdr },
        item_details: [
          {
            id: params.paymentType === "topup" ? `VISORA_TOPUP_${params.creditsQty}` : `VISORA_${params.paymentType.toUpperCase()}`,
            price: params.amountIdr,
            quantity: 1,
            name: `Visora ${params.paymentType} - ${params.amountIdr} IDR`,
          },
        ],
        customer_details: { first_name: firstName, email: params.email },
        custom_expiry: { expiry_duration: 15, unit: "minute" },
      }),
    });

    if (!snapResponse.ok) {
      const errorText = await snapResponse.text();
      throw new Error(`Midtrans Snap error: ${errorText}`);
    }

    const snapData = await snapResponse.json();
    return {
      token: snapData.token, // This token goes to Snap UI
      orderId: params.orderId,
    };
  }

  async verifyWebhook(payload: any, signature: string): Promise<boolean> {
    // Both 5000.00 and 5000 must be supported based on Midtrans documentation
    const grossRaw = String(payload.gross_amount);
    const grossInt = Math.floor(Number(payload.gross_amount)).toString();

    const makeSignature = (amount: string) => {
      const str = `${payload.order_id}${payload.status_code}${amount}${this.serverKey}`;
      return createHash("sha512").update(str).digest("hex");
    };

    const sigWithRaw = makeSignature(grossRaw);
    const sigWithInt = makeSignature(grossInt);

    return signature === sigWithRaw || signature === sigWithInt;
  }
}
