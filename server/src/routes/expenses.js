import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { validate } from "../middleware/validate.js";
import { isValidIsoDate } from "../utils/dates.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { fromCents, toCents } from "../utils/money.js";

const router = Router();
const paymentMethods = ["cash", "card", "bank", "upi", "other"];
const isoDate = z.string().refine(isValidIsoDate, "Enter a real date in YYYY-MM-DD format.");

const expenseBody = z.object({
  categoryId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive().max(1000000),
  date: isoDate,
  note: z.string().trim().max(180).optional().default(""),
  paymentMethod: z.enum(paymentMethods)
});

const listSchema = z.object({
  query: z.object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    paymentMethod: z.enum(paymentMethods).optional(),
    search: z.string().trim().max(80).optional()
  })
});

const idParam = z.object({ params: z.object({ id: z.coerce.number().int().positive() }) });

function mapExpense(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    category: row.category,
    categoryColor: row.category_color,
    amount: fromCents(row.amount_cents),
    amountCents: row.amount_cents,
    date: row.spent_at,
    note: row.note || "",
    paymentMethod: row.payment_method,
    createdAt: row.created_at
  };
}

function ensureCategory(categoryId) {
  const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(categoryId);
  if (!category) throw new ApiError(422, "VALIDATION_ERROR", "Select a valid category.");
}

router.get(
  "/",
  validate(listSchema),
  asyncHandler(async (req, res) => {
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
        `SELECT e.*, c.name AS category, c.color AS category_color
         FROM expenses e
         JOIN categories c ON c.id = e.category_id
         WHERE ${where.join(" AND ")}
         ORDER BY e.spent_at DESC, e.id DESC`
      )
      .all(...params);
    res.json({ expenses: rows.map(mapExpense) });
  })
);

router.post(
  "/",
  validate(z.object({ body: expenseBody })),
  asyncHandler(async (req, res) => {
    const { categoryId, amount, date, note, paymentMethod } = req.validated.body;
    ensureCategory(categoryId);
    const result = db
      .prepare(
        `INSERT INTO expenses (user_id, category_id, amount_cents, spent_at, note, payment_method)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, categoryId, toCents(amount), date, note, paymentMethod);
    const row = db
      .prepare(
        `SELECT e.*, c.name AS category, c.color AS category_color
         FROM expenses e JOIN categories c ON c.id = e.category_id
         WHERE e.id = ? AND e.user_id = ?`
      )
      .get(result.lastInsertRowid, req.user.id);
    res.status(201).json({ expense: mapExpense(row) });
  })
);

router.put(
  "/:id",
  validate(idParam.merge(z.object({ body: expenseBody }))),
  asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { categoryId, amount, date, note, paymentMethod } = req.validated.body;
    ensureCategory(categoryId);
    const result = db
      .prepare(
        `UPDATE expenses
         SET category_id = ?, amount_cents = ?, spent_at = ?, note = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`
      )
      .run(categoryId, toCents(amount), date, note, paymentMethod, id, req.user.id);
    if (!result.changes) throw new ApiError(404, "NOT_FOUND", "Expense not found.");
    const row = db
      .prepare(
        `SELECT e.*, c.name AS category, c.color AS category_color
         FROM expenses e JOIN categories c ON c.id = e.category_id
         WHERE e.id = ? AND e.user_id = ?`
      )
      .get(id, req.user.id);
    res.json({ expense: mapExpense(row) });
  })
);

router.delete(
  "/:id",
  validate(idParam),
  asyncHandler(async (req, res) => {
    const result = db
      .prepare("DELETE FROM expenses WHERE id = ? AND user_id = ?")
      .run(req.validated.params.id, req.user.id);
    if (!result.changes) throw new ApiError(404, "NOT_FOUND", "Expense not found.");
    res.status(204).end();
  })
);

export default router;
