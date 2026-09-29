import { Router, type IRouter } from "express";
import { db, preferencesTable } from "@workspace/db";
import {
  GetPreferencesResponse,
  SavePreferencesBody,
  SavePreferencesResponse,
} from "@workspace/api-zod";
import { loadPreferences, toPreferences } from "../lib/planner-data";
import { requireUser } from "../middlewares/requireUser";

const router: IRouter = Router();
router.use("/preferences", requireUser);

router.get("/preferences", async (_req, res): Promise<void> => {
  const preferences = await loadPreferences(res.locals.userId);
  res.json(GetPreferencesResponse.parse(preferences));
});

router.put("/preferences", async (req, res): Promise<void> => {
  const body = SavePreferencesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Select an activity level and a valid baseline target." });
    return;
  }

  const [preferences] = await db
    .insert(preferencesTable)
    .values({ userId: res.locals.userId, ...body.data })
    .onConflictDoUpdate({
      target: preferencesTable.userId,
      set: body.data,
    })
    .returning();
  res.json(SavePreferencesResponse.parse(toPreferences(preferences)));
});

export default router;