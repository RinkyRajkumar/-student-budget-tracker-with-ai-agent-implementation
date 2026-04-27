import { db } from "../db/index.js";
import { currentMonth, isValidIsoDate, localDateString } from "../utils/dates.js";

function chargeDate(month, billingDay) {
  const day = String(Math.min(28, Math.max(1, Number(billingDay)))).padStart(2, "0");
  return `${month}-${day}`;
}

function shouldCharge(subscription, month, today) {
  if (!subscription.active) return false;
  if (subscription.last_charged_month === month) return false;
  if (subscription.last_charged_month) {
    const [lastYear, lastMonth] = subscription.last_charged_month.split("-").map(Number);
    const [year, monthNumber] = month.split("-").map(Number);
    const elapsedMonths = (year - lastYear) * 12 + (monthNumber - lastMonth);
    if (elapsedMonths < subscription.interval_months) return false;
  }
  const dueDate = chargeDate(month, subscription.billing_day);
  return isValidIsoDate(dueDate) && dueDate <= today;
}

export function materializeDueSubscriptions(userId, today = new Date()) {
  const month = currentMonth();
  const todayIso = localDateString(today);
  const subscriptions = db
    .prepare(
      `SELECT s.*, c.name AS category
       FROM subscriptions s
       JOIN categories c ON c.id = s.category_id
       WHERE s.user_id = ? AND s.active = 1`
    )
    .all(userId);

  subscriptions.forEach((subscription) => {
    if (!shouldCharge(subscription, month, todayIso)) return;

    const spentAt = chargeDate(month, subscription.billing_day);
    db.prepare(
      `INSERT INTO expenses (user_id, category_id, amount_cents, spent_at, note, payment_method)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      subscription.category_id,
      subscription.amount_cents,
      spentAt,
      `${subscription.name} subscription`,
      subscription.payment_method
    );
    db.prepare("UPDATE subscriptions SET last_charged_month = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      month,
      subscription.id
    );
  });
}
