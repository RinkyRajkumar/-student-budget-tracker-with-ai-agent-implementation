import { ZodError } from "zod";
import { ApiError } from "../utils/errors.js";

export function notFound(req, res, next) {
  next(new ApiError(404, "NOT_FOUND", `Route not found: ${req.method} ${req.path}`));
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please check the highlighted fields.",
        details: err.flatten()
      }
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
    return res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "A record with those details already exists."
      }
    });
  }

  console.error(err);
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong."
    }
  });
}
