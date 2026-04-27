import "dotenv/config";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import adviceRouter from "./routes/advice.js";
import authRouter from "./routes/auth.js";
import budgetRouter from "./routes/budget.js";
import categoriesRouter from "./routes/categories.js";
import expensesRouter from "./routes/expenses.js";
import exportRouter from "./routes/export.js";
import receiptOcrRouter from "./routes/receiptOcr.js";
import savingsRouter from "./routes/savings.js";
import summaryRouter from "./routes/summary.js";
import subscriptionsRouter from "./routes/subscriptions.js";
import splitBillsRouter from "./routes/splitBills.js";

export function createApp() {
  const app = express();
  const allowedOrigins = new Set(
    (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        const isVercelApp = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin || "");
        if (!origin || allowedOrigins.has(origin) || isVercelApp) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      }
    })
  );
  app.use(express.json({ limit: "12mb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "student-budget-tracker" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/categories", requireAuth, categoriesRouter);
  app.use("/api/expenses", requireAuth, expensesRouter);
  app.use("/api/summary", requireAuth, summaryRouter);
  app.use("/api/budget", requireAuth, budgetRouter);
  app.use("/api/savings-goal", requireAuth, savingsRouter);
  app.use("/api/subscriptions", requireAuth, subscriptionsRouter);
  app.use("/api/split-bills", requireAuth, splitBillsRouter);
  app.use("/api/receipt-ocr", requireAuth, receiptOcrRouter);
  app.use("/api/advice", requireAuth, adviceRouter);
  app.use("/api/export.csv", requireAuth, exportRouter);
  app.use("/api/export", requireAuth, exportRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
