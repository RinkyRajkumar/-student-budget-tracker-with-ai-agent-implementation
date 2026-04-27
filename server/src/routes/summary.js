import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { validate } from "../middleware/validate.js";
import { currentMonth, daysRemainingInMonth, localDateOffset, localDateString, monthBounds } from "../utils/dates.js";
import { fromCents, percent } from "../utils/money.js";

const router = Router();
const monthQuery = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).default(currentMonth())
  })
});

export function buildSummary(userId, month = currentMonth()) {
  const { start, end } = monthBounds(month);
  const totalCents =
    db
      .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses WHERE user_id = ? AND spent_at BETWEEN ? AND ?")
      .get(userId, start, end).total || 0;
  const weeklyCents =
    db
      .prepare(
        "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses WHERE user_id = ? AND spent_at >= ?"
      )
      .get(userId, localDateOffset(-6)).total || 0;
  const todayCents =
    db
      .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses WHERE user_id = ? AND spent_at = ?")
      .get(userId, localDateString()).total || 0;
  const budgetCents =
    db.prepare("SELECT monthly_limit_cents FROM budgets WHERE user_id = ?").get(userId)?.monthly_limit_cents || 0;
  const categoryRows = db
    .prepare(
      `SELECT c.id, c.name, c.color, COALESCE(SUM(e.amount_cents), 0) AS total
       FROM expenses e
       JOIN categories c ON c.id = e.category_id
       WHERE e.user_id = ? AND e.spent_at BETWEEN ? AND ?
       GROUP BY c.id
       ORDER BY total DESC`
    )
    .all(userId, start, end);
  const trendRows = db
    .prepare(
      `SELECT spent_at AS date, SUM(amount_cents) AS total
       FROM expenses
       WHERE user_id = ? AND spent_at BETWEEN ? AND ?
       GROUP BY spent_at
       ORDER BY spent_at`
    )
    .all(userId, start, end);

  const budgetUsed = percent(totalCents, budgetCents);
  const remainingCents = Math.max(0, budgetCents - totalCents);
  const daysRemaining = daysRemainingInMonth(month);

  return {
    month,
    dailyTotal: fromCents(todayCents),
    weeklyTotal: fromCents(weeklyCents),
    monthlyTotal: fromCents(totalCents),
    monthlyBudget: fromCents(budgetCents),
    remainingBudget: fromCents(remainingCents),
    budgetUsedPercent: budgetUsed,
    safeToSpendPerDay: fromCents(Math.floor(remainingCents / daysRemaining)),
    daysRemaining,
    budgetStatus: totalCents > budgetCents ? "over" : budgetUsed >= 85 ? "near" : "ok",
    categories: categoryRows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      total: fromCents(row.total),
      percent: percent(row.total, totalCents)
    })),
    trend: trendRows.map((row) => ({ date: row.date, total: fromCents(row.total) }))
  };
}

router.get("/", validate(monthQuery), (req, res) => {
  res.json({ summary: buildSummary(req.user.id, req.validated.query.month) });
});

export default router;
