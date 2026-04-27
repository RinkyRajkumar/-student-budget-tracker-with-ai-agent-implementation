import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/errors.js";
import { fromCents, toCents } from "../utils/money.js";

const router = Router();

router.get("/", (req, res) => {
  const row = db.prepare("SELECT monthly_limit_cents FROM budgets WHERE user_id = ?").get(req.user.id);
  res.json({ monthlyLimit: fromCents(row?.monthly_limit_cents || 0) });
});

router.put(
  "/",
  validate(
    z.object({
      body: z.object({
        monthlyLimit: z.coerce.number().min(0).max(1000000)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const cents = toCents(req.validated.body.monthlyLimit);
    db.prepare(
      `INSERT INTO budgets (user_id, monthly_limit_cents, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET monthly_limit_cents = excluded.monthly_limit_cents, updated_at = CURRENT_TIMESTAMP`
    ).run(req.user.id, cents);
    res.json({ monthlyLimit: fromCents(cents) });
  })
);

export default router;
