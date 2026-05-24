const DB_KEY = "spendly_local_database_v1";
const RESET_KEY = "spendly_clean_finance_data_v1";

const LEGACY_KEYS_TO_CLEAR = [
  "student-budget-browser-store",
  "spendly_budget_categories",
  "student-budget-onboarding"
];

export const defaultCategories = [
  { id: 2, name: "Books", color: "#6366f1" },
  { id: 5, name: "Entertainment", color: "#d946ef" },
  { id: 10, name: "Food", color: "#f97316" },
  { id: 6, name: "Health", color: "#ef4444" },
  { id: 9, name: "Other", color: "#475569" },
  { id: 3, name: "Rent", color: "#14b8a6" },
  { id: 7, name: "Shopping", color: "#f59e0b" },
  { id: 8, name: "Subscriptions", color: "#8b5cf6" },
  { id: 1, name: "Transport", color: "#0ea5e9" },
  { id: 4, name: "Tuition", color: "#64748b" }
];

function readSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("student-budget-app-session") || "null");
  } catch {
    return null;
  }
}

function emptyDatabase() {
  const user = readSessionUser();
  return {
    version: 1,
    user: {
      id: user?.id || 1,
      name: user?.name || "Local Student",
      email: user?.email || "local@student.local",
      currency: "INR"
    },
    expenses: [],
    budget: { monthlyLimit: 0 },
    goal: { name: "", targetAmount: 0, currentAmount: 0, targetDate: "" },
    subscriptions: [],
    split: {
      groups: [],
      bills: [],
      settlements: []
    }
  };
}

export function clearLegacyFinanceData() {
  if (localStorage.getItem(RESET_KEY)) return;
  LEGACY_KEYS_TO_CLEAR.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(DB_KEY, JSON.stringify(emptyDatabase()));
  localStorage.setItem(RESET_KEY, "true");
}

export function readLocalDatabase() {
  clearLegacyFinanceData();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return writeLocalDatabase(emptyDatabase());
    const parsed = JSON.parse(raw);
    return {
      ...emptyDatabase(),
      ...parsed,
      user: { ...emptyDatabase().user, ...(parsed.user || {}) },
      split: { ...emptyDatabase().split, ...(parsed.split || {}) }
    };
  } catch {
    return writeLocalDatabase(emptyDatabase());
  }
}

export function writeLocalDatabase(next) {
  localStorage.setItem(DB_KEY, JSON.stringify(next));
  return next;
}

export function resetLocalFinanceData() {
  LEGACY_KEYS_TO_CLEAR.forEach((key) => localStorage.removeItem(key));
  return writeLocalDatabase(emptyDatabase());
}
