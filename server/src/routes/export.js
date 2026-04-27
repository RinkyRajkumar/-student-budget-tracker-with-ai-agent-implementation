import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { validate } from "../middleware/validate.js";
import { isValidIsoDate } from "../utils/dates.js";
import { fromCents } from "../utils/money.js";

const router = Router();
const isoDate = z.string().refine(isValidIsoDate, "Enter a real date in YYYY-MM-DD format.");

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

router.get(
  "/",
  validate(
    z.object({
      query: z.object({
        from: isoDate.optional(),
        to: isoDate.optional(),
        categoryId: z.coerce.number().int().positive().optional(),
        paymentMethod: z.enum(["cash", "card", "bank", "upi", "other"]).optional(),
        search: z.string().trim().max(80).optional()
      })
    })
  ),
  (req, res) => {
    const { from, to, categoryId, paymentMethod, search } = req.validated.query;
    const where = ["e.user_id = ?"];
    const params = [req.user.id];
    if (from) {
      where.push("e.spent_at >= ?");
      params.push(from);
    }
    if (to) {
      where.push("e.spent_at <= ?");
      params.push(to);
    }
    if (categoryId) {
      where.push("e.category_id = ?");
      params.push(categoryId);
    }
    if (paymentMethod) {
      where.push("e.payment_method = ?");
      params.push(paymentMethod);
    }
    if (search) {
      where.push("LOWER(e.note) LIKE ?");
      params.push(`%${search.toLowerCase()}%`);
    }

    const rows = db
      .prepare(
        `SELECT e.spent_at, c.name AS category, e.note, e.payment_method, e.amount_cents
         FROM expenses e JOIN categories c ON c.id = e.category_id
         WHERE ${where.join(" AND ")}
         ORDER BY e.spent_at DESC`
      )
      .all(...params);
    const header = ["date", "category", "note", "payment_method", "amount"];
    const lines = [
      header.join(","),
      ...rows.map((row) =>
        [row.spent_at, row.category, row.note, row.payment_method, fromCents(row.amount_cents)]
          .map(csvEscape)
          .join(",")
      )
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"student-expenses.csv\"");
    res.send(lines.join("\n"));
  }
);

export default router;
