import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { eq } from "drizzle-orm";
import { db, peopleTable, pool } from "@workspace/db";
import peopleRouter from "../src/routes/people";
import { goalHistoryChanges } from "../src/lib/goal-history";

test("goal history detects amount, source-only, unset and unchanged states", () => {
  const old = { ironGoalMg: 18, ironGoalSource: "Original" };
  assert.deepEqual(goalHistoryChanges(old, {}), []);
  assert.deepEqual(goalHistoryChanges(old, old), []);
  assert.equal(goalHistoryChanges(old, { ironGoalSource: "New" })[0].amount, 18);
  assert.equal(goalHistoryChanges(old, { ironGoalMg: null, ironGoalSource: null })[0].amount, null);
});

test("owned goal history persists actual changes, isolates people and denies other accounts", async () => {
  const owner = `goal-history-test-${randomUUID()}`;
  const other = `goal-history-other-${randomUUID()}`;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as typeof req & { auth: () => object }).auth = Object.assign(() => ({
      userId: req.headers["x-test-account"] === "other" ? other : req.headers["x-test-account"] === "anonymous" ? null : owner,
      tokenType: "session_token",
    }), { [Symbol.for("@clerk/express.auth")]: true });
    next();
  });
  app.use("/api", peopleRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/people`;
  const request = async (url: string, method = "GET", body?: object, account = "owner") => {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json", "x-test-account": account },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  };
  try {
    const create = (name: string, goals = {}) => request(base, "POST", { name, activityLevel: "sedentary", baselineCalories: 2000, ...goals });
    const person = await create("First", { ironGoalMg: 18, ironGoalSource: "Advice", fatGoalG: 60 });
    const second = await create("Second");
    assert.equal(person.status, 201);
    const url = `${base}/${person.data.id}`;
    const historyUrl = `${url}/goal-history`;
    let history = await request(historyUrl);
    assert.equal(history.data.length, 2);
    assert.equal((await request(`${base}/${second.data.id}/goal-history`)).data.length, 0);
    assert.equal((await request(historyUrl, "GET", undefined, "other")).status, 404);
    assert.equal((await request(historyUrl, "GET", undefined, "anonymous")).status, 401);
    assert.equal((await request(url, "PATCH", { ironGoalMg: 18, ironGoalSource: " Advice " })).status, 200);
    assert.equal((await request(historyUrl)).data.length, 2, "normalized unchanged save must not duplicate history");
    assert.equal((await request(url, "PATCH", { ironGoalSource: "New reference" })).status, 200);
    history = await request(historyUrl);
    assert.equal(history.data[0].previousAmount, 18);
    assert.equal(history.data[0].amount, 18);
    assert.equal(history.data[0].previousSource, "Advice");
    assert.equal(history.data[0].source, "New reference");
    assert.ok(Number.isFinite(Date.parse(history.data[0].changedAt)));
    assert.ok(!("ownerId" in history.data[0]));
    await Promise.all([
      request(url, "PATCH", { ironGoalMg: 20 }),
      request(url, "PATCH", { ironGoalMg: 22 }),
    ]);
    const concurrent = (await request(historyUrl)).data.filter((entry: { nutrient: string }) => entry.nutrient === "iron");
    assert.equal(concurrent[0].previousAmount, concurrent[1].amount, "concurrent saves retain the actual preceding goal");
    const beforeReview = (await request(historyUrl)).data.length;
    await request(url, "PATCH", { ironGoalReviewedOn: "2026-10-01" });
    assert.equal((await request(historyUrl)).data.length, beforeReview, "review date alone is not source verification or an amount/source change");
    await request(url, "PATCH", { ironGoalMg: null });
    history = await request(historyUrl);
    assert.equal(history.data[0].amount, null);
    assert.equal(history.data[0].source, null);
    assert.equal(history.data[0].previousSource, "New reference");
    const count = history.data.length;
    assert.equal((await request(url, "PATCH", { ironGoalSource: "No goal" })).status, 400);
    await request(url, "PATCH", { name: "Renamed" });
    assert.equal((await request(historyUrl)).data.length, count);
    assert.equal((await request(url, "PATCH", { fatGoalSource: "Injected" }, "other")).status, 404);
    assert.equal((await request(historyUrl)).data.length, count);
    await request(url, "PATCH", { fatGoalG: null });
    assert.equal((await request(historyUrl)).data[0].nutrient, "fat");
    assert.equal((await request(historyUrl)).data[0].amount, null);
    assert.equal((await request(`${base}/${second.data.id}/goal-history`)).data.length, 0);
    await request(url, "DELETE");
    assert.equal((await request(historyUrl)).status, 404);
  } finally {
    await db.delete(peopleTable).where(eq(peopleTable.ownerId, owner));
    await db.delete(peopleTable).where(eq(peopleTable.ownerId, other));
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
