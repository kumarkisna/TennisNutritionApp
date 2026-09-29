import { date, index, integer, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const peopleTable = pgTable(
  "planner_people",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    defaultKey: text("default_key").unique(),
    name: text("name").notNull(),
    weightKg: real("weight_kg"),
    ageYears: integer("age_years"),
    ironGoalMg: real("iron_goal_mg"),
    ironGoalSource: text("iron_goal_source"),
    ironGoalReviewedOn: date("iron_goal_reviewed_on", { mode: "string" }),
    fatGoalG: real("fat_goal_g"),
    fatGoalSource: text("fat_goal_source"),
    fatGoalReviewedOn: date("fat_goal_reviewed_on", { mode: "string" }),
    activityLevel: text("activity_level").notNull().default("sedentary"),
    baselineCalories: integer("baseline_calories").notNull().default(2000),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("planner_people_owner_idx").on(table.ownerId),
    uniqueIndex("planner_people_owner_name_idx").on(table.ownerId, table.name),
  ],
);

export const insertPersonSchema = createInsertSchema(peopleTable).omit({ id: true, createdAt: true });
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof peopleTable.$inferSelect;