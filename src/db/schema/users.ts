import { pgTable, uuid, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  whatsapp: text("whatsapp"),
  plan: text("plan", { enum: ["basic", "pro"] }).default("basic"),
  planActivatedAt: timestamp("plan_activated_at"),
  credits: integer("credits").notNull().default(0),
  isAdmin: boolean("is_admin").default(false),
  infiniteEnabled: boolean("infinite_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
