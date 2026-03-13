import { eq } from "drizzle-orm";
import { db } from "../../../src/lib/db";
import { paymentGatewayConfig } from "../../../src/db/schema/paymentGateway";
import { decrypt } from "./crypto";
import { PaymentProvider } from "./types";
import { MidtransProvider } from "./midtrans";
import { MayarProvider } from "./mayar";

export async function getActiveProvider(): Promise<{
  provider: PaymentProvider;
  name: "midtrans" | "mayar";
}> {
  // Query DB untuk mencari gateway yang sedang aktif
  const activeConfigs = await db.query.paymentGatewayConfig.findMany({
    where: eq(paymentGatewayConfig.isActive, true),
  });

  if (activeConfigs.length === 0) {
    // Fallback: gunakan midtrans default jika tidak ada yg diset aktif
    return { provider: new MidtransProvider(), name: "midtrans" };
  }

  // Jika ada lebih dari satu, ambil yang teratas (seharusnya hanya ada satu)
  const config = activeConfigs[0];

  if (config.gateway === "mayar") {
    // Ambil Mayar server key dan webhook secret dari DB (didecrypt) atau dari ENV sebagai fallback
    let serverKey = process.env.MAYAR_SERVER_KEY || "";
    let webhookSecret = process.env.MAYAR_WEBHOOK_SECRET || "";

    if (config.serverKey) serverKey = decrypt(config.serverKey);
    if (config.webhookSecret) webhookSecret = decrypt(config.webhookSecret);

    if (!serverKey) throw new Error("Mayar server key is empty. Please set it in admin dashboard.");

    return { provider: new MayarProvider(serverKey, webhookSecret), name: "mayar" };
  }

  // Gateway aktif = midtrans
  // Kita abaikan serverKey config DB untuk Midtrans karena Midtrans ada logic Sandbox vs Prod via ENV.
  return { provider: new MidtransProvider(), name: "midtrans" };
}
