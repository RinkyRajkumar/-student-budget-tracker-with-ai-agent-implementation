import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { validate } from "../middleware/validate.js";
import { isValidIsoDate } from "../utils/dates.js";
import { asyncHandler } from "../utils/errors.js";
import { fromCents, percent, toCents } from "../utils/money.js";

const router = Router();

function mapGoal(row) {
  const target = row?.target_cents || 0;
  const current = row?.current_cents || 0;
  return {
    name: row?.name || "Savings goal",
    targetAmount: fromCents(target),
    currentAmount: fromCents(current),
    targetDate: row?.target_date || "",
    remainingAmount: fromCents(Math.max(0, target - current)),
    progressPercent: percent(current, target)
  };
}

router.get("/", (req, res) => {
  const row = db.prepare("SELECT * FROM savings_goals WHERE user_id = ?").get(req.user.id);
  res.json({ goal: mapGoal(row) });
});

router.put(
  "/",
  validate(
    z.object({
      body: z.object({
        name: z.string().trim().min(2).max(80),
        targetAmount: z.coerce.number().positive().max(1000000),
        currentAmount: z.coerce.number().min(0).max(1000000),
        targetDate: z.string().refine((value) => value === "" || isValidIsoDate(value), "Enter a real target date.").optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const { name, targetAmount, currentAmount, targetDate } = req.validated.body;
    db.prepare(
      `INSERT INTO savings_goals (user_id, name, target_cents, current_cents, target_date, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         name = excluded.name,
         target_cents = excluded.target_cents,
         current_cents = excluded.current_cents,
         target_date = excluded.target_date,
         updated_at = CURRENT_TIMESTAMP`
    ).run(req.user.id, name, toCents(targetAmount), toCents(currentAmount), targetDate || null);
    const row = db.prepare("SELECT * FROM savings_goals WHERE user_id = ?").get(req.user.id);
    res.json({ goal: mapGoal(row) });
  })
);

export default router;
