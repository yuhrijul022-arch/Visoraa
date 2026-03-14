import { PaymentProvider } from "./types.js";
import { MidtransProvider } from "./midtrans.js";
import { MayarProvider } from "./mayar.js";

export async function getActiveProvider(): Promise<PaymentProvider> {
  const gateway = process.env.ACTIVE_GATEWAY ?? 'midtrans';
  
  if (gateway === 'mayar') {
    // MayarProvider now reads MAYAR_API_KEY and MAYAR_WEBHOOK_SECRET locally if not provided
    return new MayarProvider({});
  }
  
  return new MidtransProvider({
    serverKey: process.env.MIDTRANS_SERVER_KEY_PROD || process.env.MIDTRANS_SERVER_KEY_SANDBOX || process.env.MIDTRANS_SERVER_KEY!,
    clientKey: process.env.MIDTRANS_CLIENT_KEY_PROD || process.env.MIDTRANS_CLIENT_KEY_SANDBOX || process.env.MIDTRANS_CLIENT_KEY!,
  });
}
