import { pgTable, uuid, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from './users.js';

export const infiniteUsage = pgTable("infinite_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  dailyCount: integer("daily_count").notNull().default(0),
  dailyResetAt: timestamp("daily_reset_at").notNull(),
  lifetimeCount: integer("lifetime_count").notNull().default(0),
  lifetimeLimitExtendedAt: timestamp("lifetime_limit_extended_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  userIdx: uniqueIndex("infinite_usage_user_idx").on(t.userId),
}));
