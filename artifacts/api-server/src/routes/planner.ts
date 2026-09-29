import { Router, type IRouter } from "express";
import { and, eq, isNull, or } from "drizzle-orm";
import { db, foodsTable, mealEntriesTable } from "@workspace/db";
import {
  CreateMealEntryBody,
  CreateMealEntryResponse,
  DeleteMealEntryParams,
  GetDailySummaryQueryParams,
  GetDailySummaryResponse,
  ListMealEntriesQueryParams,
  ListMealEntriesResponse,
  UpdateMealEntryBody,
  UpdateMealEntryParams,
  UpdateMealEntryResponse,
} from "@workspace/api-zod";
import {
  isValidCalendarDate,
  loadEntriesForDate,
  loadPreferences,
  meals,
  sumNutrition,
  toMealEntry,
} from "../lib/planner-data";
import { requireUser } from "../middlewares/requireUser";

const router: IRouter = Router();
router.use(["/meal-entries", "/daily-summary"], requireUser);

router.get("/meal-entries", async (req, res): Promise<void> => {
  const query = ListMealEntriesQueryParams.safeParse(req.query);
  if (!query.success || !isValidCalendarDate(query.data.date)) {
    res.status(400).json({ error: "Choose a valid date." });
    return;
  }

  const rows = await loadEntriesForDate(res.locals.userId, query.data.date);
  res.json(
    ListMealEntriesResponse.parse(
      rows.map(({ entry, food }) => toMealEntry(entry, food)),
    ),
  );
});

router.post("/meal-entries", async (req, res): Promise<void> => {
  const body = CreateMealEntryBody.safeParse(req.body);
  if (!body.success || !isValidCalendarDate(body.data.date)) {
    res.status(400).json({ error: "Choose a food, date, meal and portion in grams." });
    return;
  }

  const userId: string = res.locals.userId;
  const [food] = await db
    .select()
    .from(foodsTable)
    .where(
      and(
        eq(foodsTable.id, body.data.foodId),
        or(isNull(foodsTable.ownerId), eq(foodsTable.ownerId, userId)),
      ),
    )
    .limit(1);
  if (!food) {
    res.status(404).json({ error: "Food not found in your catalog." });
    return;
  }

  const [entry] = await db
    .insert(mealEntriesTable)
    .values({
      ownerId: userId,
      plannedDate: body.data.date,
      meal: body.data.meal,
      foodId: food.id,
      grams: body.data.grams,
    })
    .returning();
  res.status(201).json(
    CreateMealEntryResponse.parse(toMealEntry(entry, food)),
  );
});

router.patch("/meal-entries/:id", async (req, res): Promise<void> => {
  const params = UpdateMealEntryParams.safeParse(req.params);
  const body = UpdateMealEntryBody.safeParse(req.body);
  if (!params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Provide a valid meal or portion change." });
    return;
  }

  const userId: string = res.locals.userId;
  const [updated] = await db
    .update(mealEntriesTable)
    .set(body.data)
    .where(
      and(
        eq(mealEntriesTable.id, params.data.id),
        eq(mealEntriesTable.ownerId, userId),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Planned food not found." });
    return;
  }

  const [food] = await db
    .select()
    .from(foodsTable)
    .where(eq(foodsTable.id, updated.foodId))
    .limit(1);
  if (!food) {
    throw new Error("A planned food has no catalog entry.");
  }
  res.json(UpdateMealEntryResponse.parse(toMealEntry(updated, food)));
});

router.delete("/meal-entries/:id", async (req, res): Promise<void> => {
  const params = DeleteMealEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid planned food id." });
    return;
  }

  const [deleted] = await db
    .delete(mealEntriesTable)
    .where(
      and(
        eq(mealEntriesTable.id, params.data.id),
        eq(mealEntriesTable.ownerId, res.locals.userId),
      ),
    )
    .returning({ id: mealEntriesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Planned food not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/daily-summary", async (req, res): Promise<void> => {
  const query = GetDailySummaryQueryParams.safeParse(req.query);
  if (!query.success || !isValidCalendarDate(query.data.date)) {
    res.status(400).json({ error: "Choose a valid date." });
    return;
  }

  const userId: string = res.locals.userId;
  const [rows, preferences] = await Promise.all([
    loadEntriesForDate(userId, query.data.date),
    loadPreferences(userId),
  ]);
  const entries = rows.map(({ entry, food }) => toMealEntry(entry, food));
  const groupedMeals = meals.map((meal) => {
    const matching = entries.filter((entry) => entry.meal === meal);
    return {
      meal,
      count: matching.length,
      nutrition: sumNutrition(matching.map((entry) => entry.nutrition)),
    };
  });

  res.json(
    GetDailySummaryResponse.parse({
      date: query.data.date,
      targetCalories: preferences.targetCalories,
      totals: sumNutrition(entries.map((entry) => entry.nutrition)),
      entryCount: entries.length,
      meals: groupedMeals,
    }),
  );
});

export default router;