import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const preferencesTable = pgTable("planner_preferences", {
  userId: text("user_id").primaryKey(),
  activityLevel: text("activity_level").notNull().default("sedentary"),
  baselineCalories: integer("baseline_calories").notNull().default(2000),
});

export const insertPreferencesSchema = createInsertSchema(preferencesTable);
export type InsertPreferences = z.infer<typeof insertPreferencesSchema>;
export type Preferences = typeof preferencesTable.$inferSelect;