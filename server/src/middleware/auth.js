import jwt from "jsonwebtoken";
import { db } from "../db/index.js";
import { materializeDueSubscriptions } from "../services/subscriptions.js";
import { ApiError } from "../utils/errors.js";

const secret = process.env.JWT_SECRET || "dev-only-secret-change-me";
const localAccountEmail = process.env.LOCAL_ACCOUNT_EMAIL || "demo@student.edu";

export function getLocalUser() {
  const user = db
    .prepare("SELECT id, name, email, currency FROM users WHERE email = ?")
    .get(localAccountEmail.toLowerCase());
  if (!user) throw new ApiError(500, "LOCAL_USER_MISSING", "Local student profile is not available.");
  return user;
}

export function signToken(user) {
  return jwt.sign({ sub: user.id }, secret, { expiresIn: "7d" });
}

export function requireAuth(req, _res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    try {
      req.user = getLocalUser();
      materializeDueSubscriptions(req.user.id);
      return next();
    } catch (err) {
      return next(err);
    }
  }

  try {
    const payload = jwt.verify(token, secret);
    const user = db
      .prepare("SELECT id, name, email, currency FROM users WHERE id = ?")
      .get(Number(payload.sub));
    if (!user) throw new Error("Missing user");
    req.user = user;
    materializeDueSubscriptions(req.user.id);
    return next();
  } catch {
    return next(new ApiError(401, "UNAUTHORIZED", "Your session is invalid or expired."));
  }
}
