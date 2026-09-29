import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { eq } from "drizzle-orm";
import { db, peopleTable, pool } from "@workspace/db";
import dayActivityRouter from "../src/routes/day-activity";
import peopleRouter from "../src/routes/people";

test("planned activity accepts each workbook category and rejects unsupported ones", async () => {
  const ownerId = `day-activity-test-${randomUUID()}`;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as typeof req & { auth: () => object }).auth = Object.assign(() => ({
      userId: ownerId,
      tokenType: "session_token",
    }), { [Symbol.for("@clerk/express.auth")]: true });
    next();
  });
  app.use("/api", peopleRouter, dayActivityRouter);
  const server = app.listen(0, "127.0.0.1");

  try {
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    const created = await fetch(`${base}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Activity test", activityLevel: "sedentary", baselineCalories: 2000 }),
    });
    assert.equal(created.status, 201);
    const person = await created.json();
    const date = "2026-09-29";
    const url = `${base}/day-activity?date=${date}&personId=${person.id}`;
    const read = async () => {
      const response = await fetch(url);
      assert.equal(response.status, 200);
      return response.json();
    };
    assert.equal((await read()).activityType, "rest", "unsaved days default to rest");

    for (const activityType of [
      "rest", "low_intensity", "training_60", "training_120",
      "endurance", "extreme", "strength",
    ]) {
      const response = await fetch(`${base}/day-activity`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, personId: person.id, activityType }),
      });
      assert.equal(response.status, 200, `${activityType}: ${await response.text()}`);
      assert.equal((await read()).activityType, activityType, `${activityType} survives reload`);
    }
    const invalid = await fetch(`${base}/day-activity`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, personId: person.id, activityType: "unsupported" }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await read()).activityType, "strength", "invalid category cannot change the saved activity");
  } finally {
    await db.delete(peopleTable).where(eq(peopleTable.ownerId, ownerId));
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});