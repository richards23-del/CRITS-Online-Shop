import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (req, res): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT
        to_regclass('public.crits_categories') IS NOT NULL AS categories,
        to_regclass('public.crits_products') IS NOT NULL AS products,
        to_regclass('public.crits_properties') IS NOT NULL AS properties,
        to_regclass('public.crits_enquiries') IS NOT NULL AS enquiries,
        to_regclass('public.crits_enquiry_items') IS NOT NULL AS enquiry_items,
        to_regclass('public.crits_analytics_events') IS NOT NULL AS analytics_events,
        to_regclass('public.crits_privacy_settings') IS NOT NULL AS privacy_settings
    `);
    if (!rows[0] || Object.values(rows[0]).some((exists) => exists !== true)) {
      throw new Error("Required CRITS database tables are missing.");
    }
    res.json(HealthCheckResponse.parse({ status: "ok" }));
  } catch (error) {
    req.log.warn({ err: error }, "API readiness check failed");
    res
      .status(503)
      .json(HealthCheckResponse.parse({ status: "unavailable" }));
  }
});

export default router;
