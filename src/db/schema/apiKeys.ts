import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  provider: text("provider", {
    enum: ["openrouter", "falai", "supabase", "midtrans", "mayar"],
  }).notNull(),
  keyValue: text("key_value").notNull(),   // encrypted AES-256-GCM
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
