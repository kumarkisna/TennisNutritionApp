import { boolean, index, pgTable, real, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const foodsTable = pgTable(
  "foods",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id"),
    referenceKey: text("reference_key").unique(),
    name: text("name").notNull(),
    brand: text("brand"),
    category: text("category").notNull(),
    caloriesPer100g: real("calories_per_100g").notNull(),
    proteinPer100g: real("protein_per_100g").notNull(),
    carbsPer100g: real("carbs_per_100g").notNull(),
    fatPer100g: real("fat_per_100g").notNull(),
    fiberPer100g: real("fiber_per_100g").notNull(),
    fiberKnown: boolean("fiber_known").notNull().default(true),
  },
  (table) => [index("foods_owner_id_idx").on(table.ownerId)],
);

export const insertFoodSchema = createInsertSchema(foodsTable).omit({ id: true });
export type InsertFood = z.infer<typeof insertFoodSchema>;
export type Food = typeof foodsTable.$inferSelect;