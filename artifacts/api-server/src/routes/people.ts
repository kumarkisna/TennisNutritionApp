import { Router, type IRouter } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, peopleTable } from "@workspace/db";
import {
  CreatePersonBody,
  CreatePersonResponse,
  DeletePersonParams,
  ListPeopleResponse,
  UpdatePersonBody,
  UpdatePersonParams,
  UpdatePersonResponse,
} from "@workspace/api-zod";
import { ensureDefaultPerson, getOwnedPerson, toPerson } from "../lib/people";
import { requireUser } from "../middlewares/requireUser";

const router: IRouter = Router();
router.use("/people", requireUser);

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

router.post("/people", async (req, res): Promise<void> => {
  const body = CreatePersonBody.safeParse(req.body);
  const name = body.success ? body.data.name.trim() : "";
  if (!body.success || !name) {
    res.status(400).json({ error: "Enter a name and valid activity target." });
    return;
  }
  const ownerId: string = res.locals.userId;
  await ensureDefaultPerson(ownerId);
  if (await nameTaken(ownerId, name)) {
    res.status(409).json({ error: "That person is already in your planner." });
    return;
  }
  const [person] = await db
    .insert(peopleTable)
    .values({
      ownerId,
      name,
      weightKg: body.data.weightKg ?? null,
      ageYears: body.data.ageYears ?? null,
      ironGoalMg: body.data.ironGoalMg ?? null,
      fatGoalG: body.data.fatGoalG ?? null,
      activityLevel: body.data.activityLevel,
      baselineCalories: body.data.baselineCalories,
    })
    .returning();
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
  const name = body.data.name?.trim();
  if (name === "") {
    res.status(400).json({ error: "Name cannot be empty." });
    return;
  }
  if (name && await nameTaken(ownerId, name, existing.id)) {
    res.status(409).json({ error: "That person is already in your planner." });
    return;
  }
  const [person] = await db
    .update(peopleTable)
    .set({ ...body.data, ...(name === undefined ? {} : { name }) })
    .where(and(eq(peopleTable.id, existing.id), eq(peopleTable.ownerId, ownerId)))
    .returning();
  res.json(UpdatePersonResponse.parse(toPerson(person)));
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