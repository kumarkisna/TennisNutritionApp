import { date, index, integer, pgTable, real, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { foodsTable } from "./foods";

export const mealEntriesTable = pgTable(
  "meal_entries",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    plannedDate: date("planned_date", { mode: "string" }).notNull(),
    meal: text("meal").notNull(),
    foodId: integer("food_id")
      .notNull()
      .references(() => foodsTable.id, { onDelete: "restrict" }),
    grams: real("grams").notNull(),
  },
  (table) => [
    index("meal_entries_owner_date_idx").on(table.ownerId, table.plannedDate),
    index("meal_entries_food_id_idx").on(table.foodId),
  ],
);

export const insertMealEntrySchema = createInsertSchema(mealEntriesTable).omit({
  id: true,
});
export type InsertMealEntry = z.infer<typeof insertMealEntrySchema>;
export type MealEntry = typeof mealEntriesTable.$inferSelect;