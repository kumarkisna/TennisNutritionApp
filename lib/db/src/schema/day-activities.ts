import { date, index, pgTable, serial, text, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { peopleTable } from "./people";

export const dayActivitiesTable = pgTable(
  "planner_day_activities",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    personId: integer("person_id").notNull().references(() => peopleTable.id, { onDelete: "cascade" }),
    plannedDate: date("planned_date", { mode: "string" }).notNull(),
    activityType: text("activity_type").notNull(),
  },
  (table) => [
    index("planner_day_activities_owner_idx").on(table.ownerId),
    uniqueIndex("planner_day_activities_person_date_idx").on(table.personId, table.plannedDate),
  ],
);

export const insertDayActivitySchema = createInsertSchema(dayActivitiesTable).omit({ id: true });
export type InsertDayActivity = z.infer<typeof insertDayActivitySchema>;
export type DayActivity = typeof dayActivitiesTable.$inferSelect;