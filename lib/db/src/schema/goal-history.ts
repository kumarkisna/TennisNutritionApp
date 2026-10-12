import { index, integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { peopleTable } from "./people";

export const goalHistoryTable = pgTable("planner_goal_history", {
  id: serial("id").primaryKey(),
  personId: integer("person_id").notNull().references(() => peopleTable.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(),
  nutrient: text("nutrient").notNull(),
  previousAmount: real("previous_amount"),
  amount: real("amount"),
  previousSource: text("previous_source"),
  source: text("source"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
}, table => [index("planner_goal_history_owner_person_idx").on(table.ownerId, table.personId)]);

export const insertGoalHistorySchema = createInsertSchema(goalHistoryTable).omit({ id: true, changedAt: true });
export type GoalHistoryRow = typeof goalHistoryTable.$inferSelect;
