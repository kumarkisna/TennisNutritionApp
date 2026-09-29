import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foodsRouter from "./foods";
import plannerRouter from "./planner";
import preferencesRouter from "./preferences";

const router: IRouter = Router();

router.use(healthRouter);
router.use(foodsRouter);
router.use(plannerRouter);
router.use(preferencesRouter);

export default router;
