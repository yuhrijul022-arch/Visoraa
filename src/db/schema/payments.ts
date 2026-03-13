import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  orderId: text("order_id").notNull().unique(),
  gateway: text("gateway", { enum: ["midtrans", "mayar"] }).notNull(),
  type: text("type", { enum: ["plan", "topup", "infinite_extend"] }).notNull(),
  planType: text("plan_type", { enum: ["basic", "pro"] }),
  creditsAmount: integer("credits_amount"),
  amountIdr: integer("amount_idr").notNull(),    // dalam Rupiah
  status: text("status", {
    enum: ["pending", "paid", "failed", "expired", "refunded"],
  }).default("pending"),
  gatewayResponse: jsonb("gateway_response"),
  webhookReceivedAt: timestamp("webhook_received_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
