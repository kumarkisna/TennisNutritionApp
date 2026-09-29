import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { eq } from "drizzle-orm";
import { db, foodsTable, pool } from "@workspace/db";
import foodsRouter from "../src/routes/foods";
import { nutritionFor, sumNutrition } from "../src/lib/planner-data";

const products = [
  {
    code: "1234567890001",
    product_name: "Known minerals",
    nutriments: { calcium_100g: "0.12", iron_100g: "0.0042" },
    expected: { calciumMgPer100g: 120, ironMgPer100g: 4.2 },
  },
  {
    code: "1234567890002",
    product_name: "Unreported minerals",
    nutriments: {},
    expected: { calciumMgPer100g: null, ironMgPer100g: null },
  },
  {
    code: "1234567890003",
    product_name: "Implausible calcium",
    nutriments: { calcium_100g: 5, iron_100g: 0.0042 },
    expected: { calciumMgPer100g: null, ironMgPer100g: 4.2 },
  },
  {
    code: "1234567890004",
    product_name: "Implausible iron",
    nutriments: { calcium_100g: 0.12, iron_100g: 0.5 },
    expected: { calciumMgPer100g: 120, ironMgPer100g: null },
  },
  {
    code: "1234567890005",
    product_name: "Reported zero",
    nutriments: { calcium_100g: 0, iron_100g: 0 },
    expected: { calciumMgPer100g: 0, ironMgPer100g: 0 },
  },
] as const;

function sourceProduct(product: (typeof products)[number]) {
  return {
    code: product.code,
    product_name: product.product_name,
    nutriments: {
      "energy-kcal_100g": 200,
      proteins_100g: 5,
      carbohydrates_100g: 30,
      fat_100g: 7,
      ...product.nutriments,
    },
  };
}

test("imported mineral grams become safe milligrams in saved foods and daily totals", async () => {
  const ownerId = `imported-minerals-test-${randomUUID()}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "world.openfoodfacts.org") {
      if (url.pathname === "/cgi/search.pl") {
        return Response.json({ products: products.map(sourceProduct) });
      }
      const code = url.pathname.match(/^\/api\/v2\/product\/(\d+)\.json$/)?.[1];
      const product = products.find((item) => item.code === code);
      return Response.json({ product: product ? sourceProduct(product) : null });
    }
    return originalFetch(input, init);
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as typeof req & { auth: () => object }).auth = Object.assign(() => ({
      userId: ownerId,
      tokenType: "session_token",
    }), { [Symbol.for("@clerk/express.auth")]: true });
    next();
  });
  app.use("/api", foodsRouter);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/foods`;
    const saved = [];
    for (const product of products) {
      const response = await fetch(`${base}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: product.code }),
      });
      const food = await response.json();
      assert.equal(response.status, 201, `${product.product_name}: ${JSON.stringify(food)}`);
      assert.equal(food.source, "open_food_facts");
      assert.equal(food.calciumMgPer100g, product.expected.calciumMgPer100g);
      assert.equal(food.ironMgPer100g, product.expected.ironMgPer100g);
      saved.push(food);
    }

    const discoveredResponse = await fetch(`${base}/discover?search=minerals`);
    assert.equal(discoveredResponse.status, 200);
    const discovered = await discoveredResponse.json();
    for (const product of products) {
      const match = discovered.find((item: { code: string }) => item.code === product.code);
      assert.ok(match, product.product_name);
      assert.equal(match.calciumMgPer100g, product.expected.calciumMgPer100g);
      assert.equal(match.ironMgPer100g, product.expected.ironMgPer100g);
    }

    const rows = await db.select().from(foodsTable).where(eq(foodsTable.ownerId, ownerId));
    assert.equal(rows.length, products.length);
    for (const product of products) {
      const row = rows.find((item) => item.referenceKey === `off:${ownerId}:${product.code}`);
      assert.ok(row, product.product_name);
      assert.equal(row.calciumMgPer100g, product.expected.calciumMgPer100g);
      assert.equal(row.ironMgPer100g, product.expected.ironMgPer100g);
    }

    const known = nutritionFor(rows.find((row) => row.name === "Known minerals")!, 50);
    assert.equal(known.calciumMg, 60);
    assert.equal(known.ironMg, 2.1);
    const zero = nutritionFor(rows.find((row) => row.name === "Reported zero")!, 100);
    assert.equal(sumNutrition([known, zero]).calciumMg, 60);
    assert.equal(sumNutrition([known, zero]).ironMg, 2.1);
    for (const name of ["Unreported minerals", "Implausible calcium"]) {
      assert.equal(sumNutrition([known, nutritionFor(rows.find((row) => row.name === name)!, 100)]).calciumMg, null);
    }
    for (const name of ["Unreported minerals", "Implausible iron"]) {
      assert.equal(sumNutrition([known, nutritionFor(rows.find((row) => row.name === name)!, 100)]).ironMg, null);
    }
  } finally {
    globalThis.fetch = originalFetch;
    await db.delete(foodsTable).where(eq(foodsTable.ownerId, ownerId));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
});