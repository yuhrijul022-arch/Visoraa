import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const paymentGatewayConfig = pgTable("payment_gateway_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  gateway: text("gateway", { enum: ["midtrans", "mayar"] }).notNull().unique(),
  isActive: boolean("is_active").default(false),
  serverKey: text("server_key"),          // encrypted at rest (AES-256-GCM)
  clientKey: text("client_key"),          // encrypted at rest
  webhookSecret: text("webhook_secret"),  // encrypted at rest
  webhookUrl: text("webhook_url"),        // auto-generated
  sandboxMode: boolean("sandbox_mode").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});
