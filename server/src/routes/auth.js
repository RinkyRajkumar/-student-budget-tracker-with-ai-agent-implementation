import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { getLocalUser, requireAuth, signToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ApiError, asyncHandler } from "../utils/errors.js";

const router = Router();

const authSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    email: z.string().trim().email().max(120),
    password: z.string().min(8).max(120),
    currency: z.string().trim().regex(/^[A-Z]{3}$/).default("INR").optional()
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(120),
    password: z.string().min(8).max(120)
  })
});

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    currency: user.currency
  };
}

router.get("/local", (_req, res) => {
  const user = getLocalUser();
  res.json({ user: publicUser(user), token: signToken(user) });
});

router.post(
  "/signup",
  validate(authSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, currency = "INR" } = req.validated.body;
    if (!name) throw new ApiError(422, "VALIDATION_ERROR", "Name is required for signup.");

    const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
    if (exists) throw new ApiError(409, "CONFLICT", "An account already exists for that email.");

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db
      .prepare("INSERT INTO users (name, email, password_hash, currency) VALUES (?, ?, ?, ?)")
      .run(name, email.toLowerCase(), passwordHash, currency);

    db.prepare("INSERT INTO budgets (user_id, monthly_limit_cents) VALUES (?, ?)").run(result.lastInsertRowid, 0);
    db.prepare(
      "INSERT INTO savings_goals (user_id, name, target_cents, current_cents) VALUES (?, ?, ?, ?)"
    ).run(result.lastInsertRowid, "", 0, 0);

    const user = db.prepare("SELECT id, name, email, currency FROM users WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  })
);

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.validated.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  })
);

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
