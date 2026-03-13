import { PaymentProvider } from "./types.js";
import { MidtransProvider } from "./midtrans.js";
import { MayarProvider } from "./mayar.js";

export async function getActiveProvider(): Promise<PaymentProvider> {
  const gateway = process.env.ACTIVE_GATEWAY ?? 'midtrans';
  
  if (gateway === 'mayar') {
    return new MayarProvider({
      serverKey: process.env.MAYAR_SERVER_KEY!,
      webhookSecret: process.env.MAYAR_WEBHOOK_SECRET!,
    });
  }
  
  return new MidtransProvider({
    serverKey: process.env.MIDTRANS_SERVER_KEY_PROD || process.env.MIDTRANS_SERVER_KEY_SANDBOX || process.env.MIDTRANS_SERVER_KEY!,
    clientKey: process.env.MIDTRANS_CLIENT_KEY_PROD || process.env.MIDTRANS_CLIENT_KEY_SANDBOX || process.env.MIDTRANS_CLIENT_KEY!,
  });
}
