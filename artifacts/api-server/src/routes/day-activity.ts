import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, dayActivitiesTable } from "@workspace/db";
import {
  GetDayActivityQueryParams,
  GetDayActivityResponse,
  SaveDayActivityBody,
  SaveDayActivityResponse,
} from "@workspace/api-zod";
import { getOwnedPerson } from "../lib/people";
import { isValidCalendarDate } from "../lib/planner-data";
import { requireUser } from "../middlewares/requireUser";

const router: IRouter = Router();
router.use("/day-activity", requireUser);

router.get("/day-activity", async (req, res): Promise<void> => {
  const query = GetDayActivityQueryParams.safeParse(req.query);
  if (!query.success || !isValidCalendarDate(query.data.date)) {
    res.status(400).json({ error: "Choose a valid date and person." });
    return;
  }
  const person = await getOwnedPerson(res.locals.userId, query.data.personId);
  if (!person) {
    res.status(404).json({ error: "Person not found in your planner." });
    return;
  }
  const [saved] = await db
    .select()
    .from(dayActivitiesTable)
    .where(and(
      eq(dayActivitiesTable.ownerId, res.locals.userId),
      eq(dayActivitiesTable.personId, person.id),
      eq(dayActivitiesTable.plannedDate, query.data.date),
    ))
    .limit(1);
  res.json(GetDayActivityResponse.parse({
    date: query.data.date,
    personId: person.id,
    activityType: saved?.activityType ?? "rest",
  }));
});

router.put("/day-activity", async (req, res): Promise<void> => {
  const body = SaveDayActivityBody.safeParse(req.body);
  if (!body.success || !isValidCalendarDate(body.data.date)) {
    res.status(400).json({ error: "Choose a valid date, person and planned activity." });
    return;
  }
  const ownerId: string = res.locals.userId;
  const person = await getOwnedPerson(ownerId, body.data.personId);
  if (!person) {
    res.status(404).json({ error: "Person not found in your planner." });
    return;
  }
  await db
    .insert(dayActivitiesTable)
    .values({
      ownerId,
      personId: person.id,
      plannedDate: body.data.date,
      activityType: body.data.activityType,
    })
    .onConflictDoUpdate({
      target: [dayActivitiesTable.personId, dayActivitiesTable.plannedDate],
      set: { activityType: body.data.activityType },
    });
  res.json(SaveDayActivityResponse.parse(body.data));
});

export default router;