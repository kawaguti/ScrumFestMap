import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").unique().notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
});

export const events = pgTable("events", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  prefecture: text("prefecture").notNull(),
  date: timestamp("date").notNull(),
  website: text("website"),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isArchived: boolean("is_archived").default(false),
  youtubePlaylist: text("youtube_playlist"),
});

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;

export const insertEventSchema = createInsertSchema(events, {
  name: z.string().min(1, "イベント名を入力してください"),
  prefecture: z.string().min(1, "開催都道府県を選択してください"),
  date: z.coerce.date(),
});
export const selectEventSchema = createSelectSchema(events);
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = z.infer<typeof selectEventSchema>;

export const eventHistory = pgTable("event_history", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  eventId: integer("event_id").notNull().references(() => events.id),
  userId: integer("user_id").notNull().references(() => users.id),
  modifiedAt: timestamp("modified_at").defaultNow().notNull(),
  modifiedColumn: text("modified_column").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
});

export const insertEventHistorySchema = createInsertSchema(eventHistory);
export const selectEventHistorySchema = createSelectSchema(eventHistory);
export type InsertEventHistory = z.infer<typeof insertEventHistorySchema>;
export type EventHistory = z.infer<typeof selectEventHistorySchema>;
