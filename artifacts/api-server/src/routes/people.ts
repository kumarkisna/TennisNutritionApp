import { Router, type IRouter } from "express";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db, goalHistoryTable, peopleTable } from "@workspace/db";
import {
  CreatePersonBody,
  CreatePersonResponse,
  DeletePersonParams,
  ListPeopleResponse,
  ListGoalHistoryParams,
  ListGoalHistoryResponse,
  UpdatePersonBody,
  UpdatePersonParams,
  UpdatePersonResponse,
} from "@workspace/api-zod";
import { ensureDefaultPerson, getOwnedPerson, toPerson } from "../lib/people";
import { isValidCalendarDate } from "../lib/planner-data";
import { requireUser } from "../middlewares/requireUser";
import { goalHistoryChanges } from "../lib/goal-history";

const router: IRouter = Router();
router.use("/people", requireUser);

type GoalChanges = {
  ironGoalMg?: number | null;
  ironGoalSource?: string | null;
  ironGoalReviewedOn?: string | null;
  fatGoalG?: number | null;
  fatGoalSource?: string | null;
  fatGoalReviewedOn?: string | null;
};

function normalizeGoalChanges(changes: GoalChanges, existing?: GoalChanges): GoalChanges | null {
  const result = { ...changes };
  for (const prefix of ["iron", "fat"] as const) {
    const amountKey = prefix === "iron" ? "ironGoalMg" : "fatGoalG";
    const sourceKey = prefix === "iron" ? "ironGoalSource" : "fatGoalSource";
    const reviewedKey = prefix === "iron" ? "ironGoalReviewedOn" : "fatGoalReviewedOn";
    const amount = result[amountKey] === undefined ? existing?.[amountKey] : result[amountKey];
    if (amount === null || amount === undefined) {
      if (result[sourceKey]?.trim() || result[reviewedKey]) return null;
      result[sourceKey] = null;
      result[reviewedKey] = null;
    } else {
      if (result[sourceKey] !== undefined) result[sourceKey] = result[sourceKey]?.trim() || null;
      const date = result[reviewedKey];
      if (date !== undefined && date !== null && !isValidCalendarDate(date)) return null;
    }
  }
  return result;
}

async function nameTaken(ownerId: string, name: string, excludingId?: number): Promise<boolean> {
  const [found] = await db
    .select({ id: peopleTable.id })
    .from(peopleTable)
    .where(
      and(
        eq(peopleTable.ownerId, ownerId),
        sql`lower(${peopleTable.name}) = lower(${name})`,
        excludingId === undefined ? undefined : ne(peopleTable.id, excludingId),
      ),
    )
    .limit(1);
  return Boolean(found);
}

router.get("/people", async (_req, res): Promise<void> => {
  const ownerId: string = res.locals.userId;
  await ensureDefaultPerson(ownerId);
  const people = await db
    .select()
    .from(peopleTable)
    .where(eq(peopleTable.ownerId, ownerId))
    .orderBy(peopleTable.id);
  res.json(ListPeopleResponse.parse(people.map(toPerson)));
});

router.get("/people/:id/goal-history", async (req, res): Promise<void> => {
  const params = ListGoalHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid person id." });
    return;
  }
  const ownerId: string = res.locals.userId;
  if (!await getOwnedPerson(ownerId, params.data.id)) {
    res.status(404).json({ error: "Person not found in your planner." });
    return;
  }
  const history = await db.select().from(goalHistoryTable)
    .where(and(eq(goalHistoryTable.ownerId, ownerId), eq(goalHistoryTable.personId, params.data.id)))
    .orderBy(desc(goalHistoryTable.changedAt), desc(goalHistoryTable.id));
  res.json(ListGoalHistoryResponse.parse(history.map(({ ownerId: _ownerId, changedAt, ...entry }) => ({
    ...entry, changedAt: changedAt.toISOString(),
  }))));
});

router.post("/people", async (req, res): Promise<void> => {
  const body = CreatePersonBody.safeParse(req.body);
  const name = body.success ? body.data.name.trim() : "";
  if (!body.success || !name) {
    res.status(400).json({ error: "Enter a name and valid activity target." });
    return;
  }
  const goals = normalizeGoalChanges(body.data);
  if (!goals) {
    res.status(400).json({ error: "Enter a valid review date, and only add source details to a goal that is set." });
    return;
  }
  const ownerId: string = res.locals.userId;
  await ensureDefaultPerson(ownerId);
  if (await nameTaken(ownerId, name)) {
    res.status(409).json({ error: "That person is already in your planner." });
    return;
  }
  const person = await db.transaction(async tx => {
    const [created] = await tx.insert(peopleTable)
    .values({
      ownerId,
      name,
      weightKg: body.data.weightKg ?? null,
      ageYears: body.data.ageYears ?? null,
      ironGoalMg: body.data.ironGoalMg ?? null,
      fatGoalG: body.data.fatGoalG ?? null,
      ...goals,
      activityLevel: body.data.activityLevel,
      baselineCalories: body.data.baselineCalories,
    })
    .returning();
    const history = goalHistoryChanges({}, created);
    if (history.length) await tx.insert(goalHistoryTable).values(history.map(entry => ({
      ...entry, ownerId, personId: created.id,
    })));
    return created;
  });
  res.status(201).json(CreatePersonResponse.parse(toPerson(person)));
});

router.patch("/people/:id", async (req, res): Promise<void> => {
  const params = UpdatePersonParams.safeParse(req.params);
  const body = UpdatePersonBody.safeParse(req.body);
  if (!params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Provide valid person changes." });
    return;
  }
  const ownerId: string = res.locals.userId;
  const existing = await getOwnedPerson(ownerId, params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Person not found in your planner." });
    return;
  }
  const goals = normalizeGoalChanges(body.data, existing);
  if (!goals) {
    res.status(400).json({ error: "Enter a valid review date, and only add source details to a goal that is set." });
    return;
  }
  const name = body.data.name?.trim();
  if (name === "") {
    res.status(400).json({ error: "Name cannot be empty." });
    return;
  }
  if (name && await nameTaken(ownerId, name, existing.id)) {
    res.status(409).json({ error: "That person is already in your planner." });
    return;
  }
  const result = await db.transaction(async tx => {
    // Serialize edits to capture the actual immediately preceding saved state.
    const [locked] = await tx.select().from(peopleTable)
      .where(and(eq(peopleTable.id, existing.id), eq(peopleTable.ownerId, ownerId))).for("update");
    if (!locked) return null;
    const currentGoals = normalizeGoalChanges(body.data, locked);
    if (!currentGoals) return { invalid: true } as const;
    const changes = { ...body.data, ...currentGoals, ...(name === undefined ? {} : { name }) };
    const history = goalHistoryChanges(locked, changes);
    const [person] = await tx.update(peopleTable).set(changes)
      .where(and(eq(peopleTable.id, locked.id), eq(peopleTable.ownerId, ownerId))).returning();
    if (history.length) await tx.insert(goalHistoryTable).values(history.map(entry => ({
      ...entry, personId: person.id, ownerId,
    })));
    return { person };
  });
  if (!result) {
    res.status(404).json({ error: "Person not found in your planner." });
    return;
  }
  if ("invalid" in result) {
    res.status(400).json({ error: "Only add source details to a goal that is set." });
    return;
  }
  res.json(UpdatePersonResponse.parse(toPerson(result.person)));
});

router.delete("/people/:id", async (req, res): Promise<void> => {
  const params = DeletePersonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid person id." });
    return;
  }
  const ownerId: string = res.locals.userId;
  const person = await getOwnedPerson(ownerId, params.data.id);
  if (!person) {
    res.status(404).json({ error: "Person not found in your planner." });
    return;
  }
  if (person.defaultKey !== null) {
    res.status(409).json({ error: "The default person cannot be deleted." });
    return;
  }
  await db
    .delete(peopleTable)
    .where(and(eq(peopleTable.id, person.id), eq(peopleTable.ownerId, ownerId)));
  res.sendStatus(204);
});

export default router;