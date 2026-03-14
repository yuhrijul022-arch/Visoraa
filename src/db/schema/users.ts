import { pgTable, uuid, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  whatsapp: text("whatsapp"),
  plan: text("plan", { enum: ["free", "basic", "pro", "enterprise"] }).default("free"),
  planActivatedAt: timestamp("plan_activated_at"),
  status: text("status", { enum: ["active", "suspended", "deleted"] }).default("active"),
  entitlementSource: text("entitlement_source"),
  adminOverrideReason: text("admin_override_reason"),
  deletedAt: timestamp("deleted_at"),
  credits: integer("credits").notNull().default(0),
  isAdmin: boolean("is_admin").default(false),
  infiniteEnabled: boolean("infinite_enabled").default(false),
  isTestAccount: boolean("is_test_account").default(false),
  isBotFlagged: boolean("is_bot_flagged").default(false),
  isSpamFlagged: boolean("is_spam_flagged").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
