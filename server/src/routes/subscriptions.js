import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { validate } from "../middleware/validate.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { fromCents, toCents } from "../utils/money.js";

const router = Router();
const paymentMethods = ["cash", "card", "bank", "upi", "other"];

const subscriptionBody = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    amount: z.coerce.number().positive().max(1000000),
    categoryId: z.coerce.number().int().positive(),
    billingDay: z.coerce.number().int().min(1).max(28),
    intervalMonths: z.coerce.number().int().refine((value) => [1, 3, 6, 12].includes(value)).default(1),
    paymentMethod: z.enum(paymentMethods).default("card"),
    active: z.coerce.boolean().default(true)
  })
});

const idParam = z.object({ params: z.object({ id: z.coerce.number().int().positive() }) });

function ensureCategory(categoryId) {
  const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(categoryId);
  if (!category) throw new ApiError(422, "VALIDATION_ERROR", "Select a valid category.");
}

function mapSubscription(row) {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    category: row.category,
    categoryColor: row.category_color,
    amount: fromCents(row.amount_cents),
    billingDay: row.billing_day,
    intervalMonths: row.interval_months,
    paymentMethod: row.payment_method,
    active: Boolean(row.active),
    lastChargedMonth: row.last_charged_month || ""
  };
}

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, c.name AS category, c.color AS category_color
       FROM subscriptions s
       JOIN categories c ON c.id = s.category_id
       WHERE s.user_id = ?
       ORDER BY s.active DESC, s.billing_day ASC, s.name ASC`
    )
    .all(req.user.id);
  res.json({ subscriptions: rows.map(mapSubscription) });
});

router.post(
  "/",
  validate(subscriptionBody),
  asyncHandler(async (req, res) => {
    const { name, amount, categoryId, billingDay, intervalMonths, paymentMethod, active } = req.validated.body;
    ensureCategory(categoryId);
    const result = db
      .prepare(
        `INSERT INTO subscriptions
          (user_id, category_id, name, amount_cents, billing_day, interval_months, payment_method, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, categoryId, name, toCents(amount), billingDay, intervalMonths, paymentMethod, active ? 1 : 0);

    const row = db
      .prepare(
        `SELECT s.*, c.name AS category, c.color AS category_color
         FROM subscriptions s JOIN categories c ON c.id = s.category_id
         WHERE s.id = ? AND s.user_id = ?`
      )
      .get(result.lastInsertRowid, req.user.id);
    res.status(201).json({ subscription: mapSubscription(row) });
  })
);

router.put(
  "/:id",
  validate(idParam.merge(subscriptionBody)),
  asyncHandler(async (req, res) => {
    const { name, amount, categoryId, billingDay, intervalMonths, paymentMethod, active } = req.validated.body;
    ensureCategory(categoryId);
    const result = db
      .prepare(
        `UPDATE subscriptions
         SET category_id = ?, name = ?, amount_cents = ?, billing_day = ?, interval_months = ?, payment_method = ?, active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`
      )
      .run(categoryId, name, toCents(amount), billingDay, intervalMonths, paymentMethod, active ? 1 : 0, req.validated.params.id, req.user.id);
    if (!result.changes) throw new ApiError(404, "NOT_FOUND", "Subscription not found.");

    const row = db
      .prepare(
        `SELECT s.*, c.name AS category, c.color AS category_color
         FROM subscriptions s JOIN categories c ON c.id = s.category_id
         WHERE s.id = ? AND s.user_id = ?`
      )
      .get(req.validated.params.id, req.user.id);
    res.json({ subscription: mapSubscription(row) });
  })
);

router.delete(
  "/:id",
  validate(idParam),
  asyncHandler(async (req, res) => {
    const result = db.prepare("DELETE FROM subscriptions WHERE id = ? AND user_id = ?").run(req.validated.params.id, req.user.id);
    if (!result.changes) throw new ApiError(404, "NOT_FOUND", "Subscription not found.");
    res.status(204).end();
  })
);

export default router;
