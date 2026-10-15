import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import shopRouter from "./shop";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(shopRouter);
router.use(adminRouter);
router.use(storageRouter);

export default router;
