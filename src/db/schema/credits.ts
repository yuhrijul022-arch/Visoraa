import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const creditsTransactions = pgTable("credits_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  type: text("type", {
    enum: ["topup", "generate_standard", "generate_pro", "welcome", "bonus"],
  }).notNull(),
  amount: integer("amount").notNull(),        // positif = masuk, negatif = keluar
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  meta: jsonb("meta"),                        // { orderId, prompt_length, gateway, etc }
  createdAt: timestamp("created_at").defaultNow(),
});
