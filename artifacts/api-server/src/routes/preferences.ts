import { Router, type IRouter } from "express";
import { db, peopleTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetPreferencesResponse,
  SavePreferencesBody,
  SavePreferencesResponse,
} from "@workspace/api-zod";
import { ensureDefaultPerson } from "../lib/people";
import { toPreferences } from "../lib/planner-data";
import { requireUser } from "../middlewares/requireUser";

const router: IRouter = Router();
router.use("/preferences", requireUser);

router.get("/preferences", async (_req, res): Promise<void> => {
  const person = await ensureDefaultPerson(res.locals.userId);
  res.json(GetPreferencesResponse.parse(toPreferences(person)));
});

router.put("/preferences", async (req, res): Promise<void> => {
  const body = SavePreferencesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Select an activity level and a valid baseline target." });
    return;
  }

  const defaultPerson = await ensureDefaultPerson(res.locals.userId);
  const [preferences] = await db
    .update(peopleTable)
    .set(body.data)
    .where(eq(peopleTable.id, defaultPerson.id))
    .returning();
  res.json(SavePreferencesResponse.parse(toPreferences(preferences)));
});

export default router;