import { Router, type IRouter, type Response } from "express";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db, foodsTable, mealEntriesTable } from "@workspace/db";
import {
  CreateFoodBody,
  CreateFoodResponse,
  DeleteFoodParams,
  DiscoverFoodsQueryParams,
  DiscoverFoodsResponse,
  ImportFoodBody,
  ImportFoodResponse,
  ListFoodsQueryParams,
  ListFoodsResponse,
  UpdateFoodBody,
  UpdateFoodParams,
  UpdateFoodResponse,
} from "@workspace/api-zod";
import {
  discoverFoods,
  findFoodByCode,
  FoodSourceRateLimitError,
} from "../lib/open-food-facts";
import { toFood } from "../lib/planner-data";
import { requireUser } from "../middlewares/requireUser";

const router: IRouter = Router();
router.use("/foods", requireUser);

function appOrigin(hostname: string): string {
  const safeHost = hostname.replace(/[^a-zA-Z0-9.-]/g, "").slice(0, 120);
  return `https://${safeHost || "replit.com"}`;
}

function handleFoodSourceError(error: unknown, res: Response): void {
  if (error instanceof FoodSourceRateLimitError) {
    res.status(429).json({ error: error.message });
    return;
  }
  // Do not expose remote errors or user-entered searches in server responses.
  res.status(502).json({ error: "The food database is temporarily unavailable. Try again shortly." });
}

router.get("/foods", async (req, res): Promise<void> => {
  const query = ListFoodsQueryParams.safeParse(req.query);
  if (!query.success || (query.data.search?.length ?? 0) > 120) {
    res.status(400).json({ error: "Invalid food search." });
    return;
  }

  const userId: string = res.locals.userId;
  const visible = or(isNull(foodsTable.ownerId), eq(foodsTable.ownerId, userId));
  const search = query.data.search?.trim();
  const escapedSearch = search?.replace(/[%_\\]/g, "\\$&");
  const where = escapedSearch
    ? and(visible, or(ilike(foodsTable.name, `%${escapedSearch}%`), ilike(foodsTable.brand, `%${escapedSearch}%`)))
    : visible;

  const foods = await db
    .select()
    .from(foodsTable)
    .where(where)
    .orderBy(foodsTable.name)
    .limit(100);
  res.json(ListFoodsResponse.parse(foods.map(toFood)));
});

router.post("/foods", async (req, res): Promise<void> => {
  const body = CreateFoodBody.safeParse(req.body);
  const name = body.success ? body.data.name.trim() : "";
  if (!body.success || !name) {
    res.status(400).json({ error: "Enter a food name and valid values per 100 g." });
    return;
  }

  const [food] = await db
    .insert(foodsTable)
    .values({ ...body.data, name, ownerId: res.locals.userId })
    .returning();
  res.status(201).json(CreateFoodResponse.parse(toFood(food)));
});

router.get("/foods/discover", async (req, res): Promise<void> => {
  const query = DiscoverFoodsQueryParams.safeParse(req.query);
  const search = query.success ? query.data.search.trim() : "";
  if (!query.success || search.length < 3 || search.length > 80) {
    res.status(400).json({ error: "Enter at least 3 characters to search more foods." });
    return;
  }
  try {
    const products = await discoverFoods(search, appOrigin(req.hostname));
    res.json(DiscoverFoodsResponse.parse(products));
  } catch (error) {
    handleFoodSourceError(error, res);
  }
});

router.post("/foods/import", async (req, res): Promise<void> => {
  const body = ImportFoodBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Choose a valid food to save." });
    return;
  }
  const userId: string = res.locals.userId;
  const referenceKey = `off:${userId}:${body.data.code}`;
  const [existing] = await db
    .select()
    .from(foodsTable)
    .where(and(eq(foodsTable.ownerId, userId), eq(foodsTable.referenceKey, referenceKey)))
    .limit(1);
  if (existing) {
    res.status(201).json(ImportFoodResponse.parse(toFood(existing)));
    return;
  }

  try {
    const product = await findFoodByCode(body.data.code, appOrigin(req.hostname));
    if (!product) {
      res.status(422).json({ error: "This food has no usable per-100 g nutrition data." });
      return;
    }
    const [created] = await db
      .insert(foodsTable)
      .values({
        ownerId: userId,
        referenceKey,
        name: product.name,
        brand: product.brand,
        category: "other",
        caloriesPer100g: product.caloriesPer100g,
        proteinPer100g: product.proteinPer100g,
        carbsPer100g: product.carbsPer100g,
        fatPer100g: product.fatPer100g,
        fiberPer100g: product.fiberPer100g,
        fiberKnown: product.fiberKnown,
      })
      .onConflictDoNothing({ target: foodsTable.referenceKey })
      .returning();
    const food = created ?? (await db
      .select()
      .from(foodsTable)
      .where(eq(foodsTable.referenceKey, referenceKey))
      .limit(1))[0];
    if (!food) throw new Error("Imported food could not be retrieved.");
    res.status(201).json(ImportFoodResponse.parse(toFood(food)));
  } catch (error) {
    handleFoodSourceError(error, res);
  }
});

router.patch("/foods/:id", async (req, res): Promise<void> => {
  const params = UpdateFoodParams.safeParse(req.params);
  const body = UpdateFoodBody.safeParse(req.body);
  if (!params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Provide valid food changes." });
    return;
  }

  const name = body.data.name?.trim();
  if (name === "") {
    res.status(400).json({ error: "Food name cannot be empty." });
    return;
  }

  const [food] = await db
    .update(foodsTable)
    .set({ ...body.data, ...(name === undefined ? {} : { name }) })
    .where(
      and(
        eq(foodsTable.id, params.data.id),
        eq(foodsTable.ownerId, res.locals.userId),
        isNull(foodsTable.referenceKey),
      ),
    )
    .returning();
  if (!food) {
    res.status(404).json({ error: "Custom food not found." });
    return;
  }
  res.json(UpdateFoodResponse.parse(toFood(food)));
});

router.delete("/foods/:id", async (req, res): Promise<void> => {
  const params = DeleteFoodParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid food id." });
    return;
  }

  const [food] = await db
    .select({ id: foodsTable.id })
    .from(foodsTable)
    .where(
      and(
        eq(foodsTable.id, params.data.id),
        eq(foodsTable.ownerId, res.locals.userId),
      ),
    )
    .limit(1);
  if (!food) {
    res.status(404).json({ error: "Food not found in your catalog." });
    return;
  }

  const [used] = await db
    .select({ id: mealEntriesTable.id })
    .from(mealEntriesTable)
    .where(eq(mealEntriesTable.foodId, food.id))
    .limit(1);
  if (used) {
    res.status(409).json({
      error: "Remove this food from your planned meals before deleting it.",
    });
    return;
  }

  await db.delete(foodsTable).where(eq(foodsTable.id, food.id));
  res.sendStatus(204);
});

export default router;