import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from './users.js';

export const adminLogs = pgTable("admin_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),       // e.g. "edit_credits", "toggle_gateway"
  targetUserId: uuid("target_user_id").references(() => users.id),
  meta: jsonb("meta"),                    // detail perubahan
  createdAt: timestamp("created_at").defaultNow(),
});
