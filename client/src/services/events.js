import { localDateString } from "./dates.js";

export const EVENTS_KEY = "spendly_events";
export const EVENT_EXPENSE_LINKS_KEY = "spendly_event_expense_links";

export function readEvents() {
  try {
    const rows = JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function saveEvents(events) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  window.dispatchEvent(new CustomEvent("spendly-events-updated"));
  return events;
}

export function readEventLinks() {
  try {
    const rows = JSON.parse(localStorage.getItem(EVENT_EXPENSE_LINKS_KEY) || "{}");
    return rows && typeof rows === "object" ? rows : {};
  } catch {
    return {};
  }
}

export function saveEventLink(expenseId, event) {
  if (!expenseId || !event?.id) return;
  const links = readEventLinks();
  links[String(expenseId)] = { eventId: event.id, eventName: event.name };
  localStorage.setItem(EVENT_EXPENSE_LINKS_KEY, JSON.stringify(links));
}

export function removeEventLinks(expenseIds = []) {
  const ids = new Set(expenseIds.map((id) => String(id)));
  const links = readEventLinks();
  Object.keys(links).forEach((id) => {
    if (ids.has(id)) delete links[id];
  });
  localStorage.setItem(EVENT_EXPENSE_LINKS_KEY, JSON.stringify(links));
}

export function enrichExpensesWithEvents(expenses = []) {
  const links = readEventLinks();
  return expenses.map((expense) => {
    const linked = links[String(expense.id)];
    if (!linked) return expense;
    return { ...expense, eventId: linked.eventId, eventName: linked.eventName };
  });
}

export function eventStatus(event, spent = 0) {
  if (Number(spent || 0) > Number(event.budgetAmount || 0)) return "Over Budget";
  if (event.completed) return "Completed";
  const today = localDateString();
  if (today < event.startDate) return "Upcoming";
  if (today > event.endDate) return "Completed";
  return "Active";
}

export function eventStats(event, expenses = []) {
  const linkedExpenses = expenses.filter((expense) => String(expense.eventId) === String(event.id));
  const totalSpent = linkedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const budgetAmount = Number(event.budgetAmount || 0);
  const remaining = budgetAmount - totalSpent;
  const today = localDateString();
  const end = new Date(`${event.endDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const remainingDays = Math.max(1, Math.ceil((end - now) / 86400000) + 1);
  return {
    expenses: linkedExpenses,
    totalSpent,
    remaining,
    usedPercentage: budgetAmount ? Math.min(100, Math.round((totalSpent / budgetAmount) * 1000) / 10) : 0,
    dailySafeSpend: remaining / remainingDays,
    remainingDays,
    status: eventStatus(event, totalSpent)
  };
}
