import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { eq } from "drizzle-orm";
import { db, foodsTable, peopleTable, mealEntriesTable, pool } from "@workspace/db";
import foodsRouter from "../src/routes/foods";
import peopleRouter from "../src/routes/people";
import plannerRouter from "../src/routes/planner";

test("mineral corrections preserve supplier data, update plans, distinguish unknown/zero, and restore safely", async () => {
  const owner = `mineral-corrections-${randomUUID()}`;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as typeof req & { auth: () => object }).auth = Object.assign(() => ({
      userId: req.headers["x-test-account"] === "other" ? "other-account" : req.headers["x-test-account"] === "anonymous" ? null : owner,
      tokenType: "session_token",
    }), { [Symbol.for("@clerk/express.auth")]: true });
    next();
  });
  app.use("/api", foodsRouter, peopleRouter, plannerRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const request = async (path: string, method = "GET", body?: object, account = "owner") => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { "Content-Type": "application/json", "x-test-account": account },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    const [food] = await db.insert(foodsTable).values({
      ownerId: owner, referenceKey: `off:${owner}:1234567890001`, name: "Correction test",
      category: "other", caloriesPer100g: 200, proteinPer100g: 5, carbsPer100g: 30,
      fatPer100g: 7, fiberPer100g: 2, calciumMgPer100g: 120, ironMgPer100g: 4.2,
    }).returning();
    const person = await request("/people", "POST", { name: "Test", activityLevel: "sedentary", baselineCalories: 2000 });
    const meal = await request("/meal-entries", "POST", { personId: person.data.id, date: "2026-10-01", foodId: food.id, meal: "breakfast", grams: 50 });
    assert.equal(meal.status, 201);
    const url = `/foods/${food.id}/mineral-corrections`;
    const values = { calciumCorrectionEnabled: true, calciumMgPer100g: 80, ironCorrectionEnabled: true, ironMgPer100g: 1.2, note: " Pack label " };
    assert.equal((await request(url, "PATCH", values, "other")).status, 404);
    assert.equal((await request(url, "PATCH", values, "anonymous")).status, 401);
    for (const invalid of [{ ironMgPer100g: -1 }, { calciumMgPer100g: 10001 }, { ironMgPer100g: "2" }, { note: "x".repeat(301) }]) {
      assert.equal((await request(url, "PATCH", { ...values, ...invalid })).status, 400);
    }
    const corrected = await request(url, "PATCH", values);
    assert.equal(corrected.status, 200);
    assert.equal(corrected.data.source, "open_food_facts");
    assert.match(corrected.data.sourceUrl, /1234567890001$/);
    assert.equal(corrected.data.supplierCalciumMgPer100g, 120);
    assert.equal(corrected.data.supplierIronMgPer100g, 4.2);
    assert.equal(corrected.data.calciumMgPer100g, 80);
    assert.equal(corrected.data.ironMgPer100g, 1.2);
    assert.equal(corrected.data.mineralCorrectionNote, "Pack label");
    const summaryPath = `/daily-summary?personId=${person.data.id}&date=2026-10-01`;
    const summary = await request(summaryPath);
    assert.equal(summary.data.totals.calciumMg, 40);
    assert.equal(summary.data.totals.ironMg, 0.6);
    assert.equal(summary.data.totals.calories, 100);
    const entries = await request(`/meal-entries?personId=${person.data.id}&date=2026-10-01`);
    assert.equal(entries.data[0].food.ironCorrectionEnabled, true);
    assert.equal(entries.data[0].nutrition.ironMg, 0.6);
    const catalog = await request("/foods?search=Correction%20test");
    assert.equal(catalog.data[0].ironMgPer100g, 1.2);
    const reimported = await request("/foods/import", "POST", { code: "1234567890001" });
    assert.equal(reimported.data.id, food.id);
    assert.equal(reimported.data.ironMgPer100g, 1.2, "re-import must keep the correction");
    await request(url, "PATCH", { ...values, calciumMgPer100g: null, ironMgPer100g: 0 });
    const unknown = await request(summaryPath);
    assert.equal(unknown.data.totals.calciumMg, null, "unknown remains distinct from zero");
    assert.equal(unknown.data.totals.ironMg, 0);
    const restored = await request(url, "PATCH", { ...values, calciumCorrectionEnabled: false, ironCorrectionEnabled: false });
    assert.equal(restored.data.calciumMgPer100g, 120);
    assert.equal(restored.data.ironMgPer100g, 4.2);
    assert.equal(restored.data.mineralCorrectionNote, null);
    assert.equal((await request(summaryPath)).data.totals.ironMg, 2.1);
    const [stored] = await db.select().from(foodsTable).where(eq(foodsTable.id, food.id));
    assert.equal(stored.calciumMgPer100g, 120);
    assert.equal(stored.ironMgPer100g, 4.2);
    assert.equal(stored.ironCorrectionMgPer100g, null);
    assert.equal((await request(`/foods/${food.id}`, "PATCH", { ironMgPer100g: 7 })).status, 404, "normal edit may not overwrite supplier data");
    const custom = await request("/foods", "POST", { name: "Custom", category: "other", caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, fiberPer100g: 0 });
    assert.equal((await request(`/foods/${custom.data.id}/mineral-corrections`, "PATCH", values)).status, 404);
  } finally {
    await db.delete(mealEntriesTable).where(eq(mealEntriesTable.ownerId, owner));
    await db.delete(peopleTable).where(eq(peopleTable.ownerId, owner));
    await db.delete(foodsTable).where(eq(foodsTable.ownerId, owner));
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
