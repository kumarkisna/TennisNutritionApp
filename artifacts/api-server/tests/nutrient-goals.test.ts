import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { eq } from "drizzle-orm";
import { db, peopleTable, pool } from "@workspace/db";
import peopleRouter from "../src/routes/people";
import { sumNutrition, type Nutrition } from "../src/lib/planner-data";

test("goal inputs reject invalid numbers and persist only for the selected person", async () => {
  const ownerId = `nutrient-goals-test-${randomUUID()}`;
  const app = express();
  app.use(express.json());
  // The test owns this isolated account; production still uses Clerk's middleware.
  app.use((req, _res, next) => {
    (req as typeof req & { auth: () => object }).auth = Object.assign(() => ({
      userId: ownerId,
      tokenType: "session_token",
    }), { [Symbol.for("@clerk/express.auth")]: true });
    next();
  });
  app.use("/api", peopleRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/people`;
  const request = async (url: string, method = "GET", body?: object) => {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };

  try {
    const basePerson = { activityLevel: "sedentary", baselineCalories: 2000 };
    for (const goals of [
      { ironGoalMg: 0 }, { ironGoalMg: -1 }, { ironGoalMg: 101 },
      { ironGoalMg: "18" }, { fatGoalG: 0 }, { fatGoalG: -1 },
      { fatGoalG: 501 }, { fatGoalG: "70" },
    ]) {
      const result = await request(base, "POST", { ...basePerson, name: "Rejected", ...goals });
      assert.equal(result.status, 400, `create accepted ${JSON.stringify(goals)}`);
    }

    const first = await request(base, "POST", {
      ...basePerson, name: "First", ironGoalMg: 18, fatGoalG: 70,
    });
    const second = await request(base, "POST", {
      ...basePerson, name: "Second", ironGoalMg: 12, fatGoalG: 55,
    });
    assert.equal(first.status, 201, JSON.stringify(first.data));
    assert.equal(second.status, 201, JSON.stringify(second.data));
    assert.equal(first.data.ironGoalMg, 18);
    assert.equal(first.data.fatGoalG, 70);

    const url = `${base}/${first.data.id}`;
    for (const goals of [
      { ironGoalMg: 0 }, { ironGoalMg: -0.1 }, { ironGoalMg: 101 },
      { fatGoalG: 0 }, { fatGoalG: -0.1 }, { fatGoalG: 501 },
    ]) {
      const result = await request(url, "PATCH", goals);
      assert.equal(result.status, 400, `update accepted ${JSON.stringify(goals)}`);
    }
    const atLimits = await request(url, "PATCH", { ironGoalMg: 0.01, fatGoalG: 500 });
    assert.equal(atLimits.status, 200, JSON.stringify(atLimits.data));
    assert.equal(atLimits.data.ironGoalMg, 0.01);
    assert.equal(atLimits.data.fatGoalG, 500);
    assert.equal((await request(base)).data.find((p: { id: number }) => p.id === first.data.id).fatGoalG, 500);
    assert.equal((await request(url, "PATCH", { ironGoalMg: 18, fatGoalG: 70 })).status, 200);
    const stillSaved = await request(base);
    assert.equal(stillSaved.status, 200);
    assert.equal(stillSaved.data.find((p: { id: number }) => p.id === first.data.id).ironGoalMg, 18);

    // Explicit null clears a goal. Omitted fields must remain unchanged.
    const clearedIron = await request(url, "PATCH", { ironGoalMg: null });
    assert.equal(clearedIron.status, 200, JSON.stringify(clearedIron.data));
    assert.equal(clearedIron.data.ironGoalMg, null);
    assert.equal(clearedIron.data.fatGoalG, 70);
    assert.equal((await request(url, "PATCH", { fatGoalG: null })).data.fatGoalG, null);
    const reloaded = await request(base);
    assert.equal(reloaded.data.find((p: { id: number }) => p.id === first.data.id).ironGoalMg, null);
    assert.equal(reloaded.data.find((p: { id: number }) => p.id === first.data.id).fatGoalG, null);
    assert.equal(reloaded.data.find((p: { id: number }) => p.id === second.data.id).ironGoalMg, 12);
    assert.equal(reloaded.data.find((p: { id: number }) => p.id === second.data.id).fatGoalG, 55);
  } finally {
    await db.delete(peopleTable).where(eq(peopleTable.ownerId, ownerId));
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});

test("one unreported iron value prevents a complete daily iron total", () => {
  const portion: Nutrition = {
    calories: 120, protein: 4, carbs: 20, fat: 3, fiber: 2, calciumMg: 40, ironMg: 4.2,
  };
  assert.equal(sumNutrition([portion]).ironMg, 4.2);
  assert.equal(sumNutrition([portion, { ...portion, ironMg: null }]).ironMg, null);
  assert.equal(sumNutrition([]).ironMg, 0);
});