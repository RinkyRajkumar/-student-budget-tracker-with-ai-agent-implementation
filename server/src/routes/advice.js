import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { validate } from "../middleware/validate.js";
import { currentMonth, daysInMonth, daysRemainingInMonth, monthBounds, weekOfYear } from "../utils/dates.js";
import { fromCents, percent } from "../utils/money.js";

const router = Router();

const suggestions = {
  Food: [
    "Set a weekly meal budget before ordering food.",
    "Replace two outside meals with packed or cafeteria meals."
  ],
  Transport: [
    "Batch errands into fewer trips.",
    "Use campus transport or public transit for short distances."
  ],
  Entertainment: [
    "Pick one paid outing this week and keep the rest free or low-cost.",
    "Use student discounts before booking events or subscriptions."
  ],
  Shopping: [
    "Use a 24-hour wait rule before non-essential purchases.",
    "Separate academic needs from wants before checkout."
  ],
  Books: [
    "Check library, used-book, or shared-resource options first.",
    "Compare rental, used, and digital textbook prices."
  ],
  Other: [
    "Review recent purchases and mark which ones were necessary.",
    "Set a small buffer for unplanned expenses."
  ]
};

const weeklyTips = [
  "Plan one no-spend day this week.",
  "Review subscriptions and pause anything unused.",
  "Set a fixed weekly food limit before the week starts.",
  "Move savings aside first, then spend from the remainder.",
  "Check your top three expenses from last week before spending this week.",
  "Use student discounts before paying full price.",
  "Keep a small buffer for unexpected academic or travel costs."
];

const notePatterns = [
  {
    key: "outside_food",
    label: "Food notes",
    category: "Food",
    terms: ["coffee", "snack", "snacks", "cafe", "restaurant", "lunch", "dinner", "order", "zomato", "swiggy"],
    message: "Your notes mention bought meals or snacks. Try setting a weekly cafe/order cap and prep one low-cost meal option."
  },
  {
    key: "paid_rides",
    label: "Travel notes",
    category: "Transport",
    terms: ["uber", "ola", "cab", "taxi", "ride", "fuel", "auto", "metro", "recharge"],
    message: "Transport notes show recurring travel costs. Batch trips or compare student passes before topping up."
  },
  {
    key: "subscriptions",
    label: "Subscription notes",
    category: "Subscriptions",
    terms: ["subscription", "plan", "monthly", "netflix", "spotify", "prime", "app"],
    message: "Subscription notes are worth reviewing. Pause any app or plan you have not used this week."
  },
  {
    key: "shopping",
    label: "Shopping notes",
    category: "Shopping",
    terms: ["shopping", "clothes", "amazon", "flipkart", "supplies", "dorm", "impulse"],
    message: "Shopping notes suggest non-routine purchases. Use a 24-hour wait before buying anything non-essential."
  },
  {
    key: "study_costs",
    label: "Study notes",
    category: "Books",
    terms: ["book", "textbook", "course", "lab", "notebook", "print", "library"],
    message: "Study-related notes are valid, but compare used, shared, rental, or library options before buying new."
  }
];

function buildNoteInsights(expenses) {
  const insights = new Map();
  expenses.forEach((expense) => {
    const note = String(expense.note || "").toLowerCase();
    const match =
      notePatterns.find((pattern) => pattern.terms.some((term) => note.includes(term))) ||
      notePatterns.find((pattern) => pattern.category === expense.category);
    if (!match) return;

    const current = insights.get(match.key) || {
      topic: match.key,
      label: match.label,
      count: 0,
      amountCents: 0,
      message: match.message
    };
    current.count += 1;
    current.amountCents += Number(expense.amount_cents) || 0;
    insights.set(match.key, current);
  });

  return [...insights.values()]
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 3)
    .map((item) => ({
      topic: item.topic,
      label: item.label,
      count: item.count,
      amount: fromCents(item.amountCents),
      message: item.message
    }));
}

router.get(
  "/",
  validate(z.object({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).default(currentMonth()) }) })),
  (req, res) => {
    const month = req.validated.query.month;
    const { start, end } = monthBounds(month);
    const totalCents =
      db
        .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses WHERE user_id = ? AND spent_at BETWEEN ? AND ?")
        .get(req.user.id, start, end).total || 0;
    const budgetCents =
      db.prepare("SELECT monthly_limit_cents FROM budgets WHERE user_id = ?").get(req.user.id)?.monthly_limit_cents || 0;
    const categories = db
      .prepare(
        `SELECT c.name, SUM(e.amount_cents) AS total
         FROM expenses e JOIN categories c ON c.id = e.category_id
         WHERE e.user_id = ? AND e.spent_at BETWEEN ? AND ?
         GROUP BY c.id ORDER BY total DESC`
      )
      .all(req.user.id, start, end);
    const notedExpenses = db
      .prepare(
        `SELECT e.note, e.amount_cents, e.spent_at, c.name AS category
         FROM expenses e JOIN categories c ON c.id = e.category_id
         WHERE e.user_id = ?
           AND e.spent_at BETWEEN ? AND ?
           AND TRIM(COALESCE(e.note, '')) <> ''`
      )
      .all(req.user.id, start, end);

    const highest = categories[0];
    const noteInsights = buildNoteInsights(notedExpenses);
    const remainingCents = budgetCents - totalCents;
    const daysRemaining = daysRemainingInMonth(month);
    const perDayCents = Math.max(0, Math.floor(remainingCents / daysRemaining));
    const usedPercent = percent(totalCents, budgetCents);
    const today = new Date();
    const elapsedPercent =
      month === currentMonth() ? percent(today.getDate(), daysInMonth(month)) : 100;

    const alerts = [];
    if (budgetCents <= 0) {
      alerts.push({ level: "medium", message: "Set a monthly budget to unlock budget alerts." });
    } else if (totalCents > budgetCents) {
      alerts.push({ level: "critical", message: "You have exceeded your monthly budget." });
    } else if (usedPercent >= 90) {
      alerts.push({ level: "high", message: "You have used over 90% of your monthly budget." });
    } else if (usedPercent >= 75 && elapsedPercent < 75) {
      alerts.push({ level: "medium", message: "You are spending faster than the month is passing." });
    } else {
      alerts.push({ level: "normal", message: "Your spending is within the expected range." });
    }

    const highestName = highest?.name;
    let weeklyTip = weeklyTips[weekOfYear(today) % weeklyTips.length];
    if (highestName === "Food") weeklyTip = "Choose a weekly food limit and track orders against it.";
    if (highestName === "Transport") weeklyTip = "Plan trips together this week to reduce transport costs.";
    if (noteInsights[0]?.topic === "outside_food") weeklyTip = "Your notes show food/snack spending; pick two low-cost meal swaps this week.";
    if (noteInsights[0]?.topic === "subscriptions") weeklyTip = "Your notes show plan or app spending; cancel or pause one unused subscription.";
    if (budgetCents && remainingCents < budgetCents * 0.15) weeklyTip = "Keep this week focused on essentials only.";

    const noteSuggestion = noteInsights[0]?.message;
    const categorySuggestions = suggestions[highestName] || suggestions.Other;

    res.json({
      advice: {
        summary: totalCents
          ? `${highestName} is your highest spending area this month.${
              noteInsights.length ? ` Your notes also point to ${noteInsights[0].label.toLowerCase()}.` : ""
            }`
          : "No spending recorded for this month yet.",
        highestCategory: highest
          ? {
              category: highest.name,
              amount: fromCents(highest.total),
              percentOfSpend: percent(highest.total, totalCents)
            }
          : null,
        safeToSpend: {
          totalRemaining: fromCents(Math.max(0, remainingCents)),
          perDay: fromCents(perDayCents),
          daysRemaining,
          status: remainingCents < 0 ? "over_budget" : perDayCents < budgetCents * 0.01 ? "tight" : "safe"
        },
        alerts,
        suggestions: noteSuggestion ? [noteSuggestion, ...categorySuggestions].slice(0, 3) : categorySuggestions,
        noteInsights,
        weeklyTip
      }
    });
  }
);

export default router;
