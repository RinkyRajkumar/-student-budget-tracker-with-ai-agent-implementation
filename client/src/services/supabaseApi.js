import { defaultCategories, readLocalDatabase } from "./localDatabase.js";
import { getSupabase } from "./supabaseClient.js";

const SESSION_KEY = "student-budget-app-session";
const SUPABASE_MIGRATION_KEY_PREFIX = "spendly_supabase_imported_local_data_";

const today = () => new Date().toISOString().slice(0, 10);
const month = () => today().slice(0, 7);

function response(data) {
  return Promise.resolve({ data });
}

function readSessionUser() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

async function requireSupabaseUser() {
  const supabase = getSupabase();
  const localUser = readSessionUser();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please login again to sync with Supabase.");
  const user = {
    id: data.user.id,
    name: localUser?.id === data.user.id ? localUser.name : data.user.user_metadata?.name || data.user.email?.split("@")[0] || "Student",
    email: data.user.email
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  await importLocalFinanceData(supabase, user.id);
  return { supabase, user };
}

function normalizeExpense(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    category: row.category_name,
    categoryColor: row.category_color,
    amount: Number(row.amount || 0),
    amountCents: Math.round(Number(row.amount || 0) * 100),
    date: row.spent_on,
    note: row.note || "",
    paymentMethod: row.payment_method,
    eventId: row.event_id || null,
    eventName: row.event_name || null,
    createdAt: row.created_at
  };
}

function normalizeEvent(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type || "Other",
    startDate: row.start_date,
    endDate: row.end_date,
    budgetAmount: Number(row.budget_amount || 0),
    notes: row.notes || "",
    category: row.category || "Food",
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeSubscription(row) {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    category: row.category_name,
    categoryColor: row.category_color,
    amount: Number(row.amount || 0),
    billingDay: Number(row.billing_day || 1),
    intervalMonths: Number(row.interval_months || 1),
    paymentMethod: row.payment_method,
    active: row.active,
    notes: row.notes || "",
    lastChargedMonth: row.last_charged_month || ""
  };
}

function categoryById(categories, categoryId) {
  return categories.find((item) => Number(item.id) === Number(categoryId)) || defaultCategories.find((item) => item.name === "Other") || defaultCategories[0];
}

function localDatabaseSnapshot() {
  try {
    return readLocalDatabase();
  } catch {
    return { expenses: [], subscriptions: [], events: [], budget: { monthlyLimit: 0 } };
  }
}

function sameExpenseKey(item) {
  return [
    item.date || item.spent_on || "",
    Number(item.amount || 0).toFixed(2),
    String(item.category || item.category_name || "").trim().toLowerCase(),
    String(item.note || "").trim().toLowerCase(),
    String(item.paymentMethod || item.payment_method || "").trim().toLowerCase()
  ].join("|");
}

function mergeLocalExpenses(userId, supabaseRows) {
  const state = localDatabaseSnapshot();
  const existing = new Set(supabaseRows.map(sameExpenseKey));
  const localRows = (state.expenses || [])
    .filter((item) => !item.userId || String(item.userId) === String(userId) || String(state.user?.id) === String(userId) || state.user?.email)
    .filter((item) => !existing.has(sameExpenseKey(item)))
    .map((item) => ({
      ...item,
      id: `local-${item.id}`,
      categoryId: item.categoryId,
      category: item.category,
      categoryColor: item.categoryColor,
      amount: Number(item.amount || 0),
      amountCents: Math.round(Number(item.amount || 0) * 100),
      date: item.date,
      note: item.note || "",
      paymentMethod: item.paymentMethod || "other",
      eventId: item.eventId || null,
      eventName: item.eventName || null,
      createdAt: item.createdAt || new Date().toISOString(),
      localOnly: true
    }));
  return [...supabaseRows, ...localRows].sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
}

function mergeLocalSubscriptions(userId, supabaseRows) {
  const state = localDatabaseSnapshot();
  const existing = new Set(supabaseRows.map((item) => `${item.name}`.trim().toLowerCase()));
  const localRows = (state.subscriptions || [])
    .filter((item) => !item.userId || String(item.userId) === String(userId) || String(state.user?.id) === String(userId) || state.user?.email)
    .filter((item) => !existing.has(`${item.name}`.trim().toLowerCase()))
    .map((item) => ({ ...item, id: `local-${item.id}`, localOnly: true }));
  return [...supabaseRows, ...localRows];
}

function mergeLocalEvents(userId, supabaseRows) {
  const state = localDatabaseSnapshot();
  const existing = new Set(supabaseRows.map((item) => `${item.name}|${item.startDate}|${item.endDate}`.toLowerCase()));
  const localRows = (state.events || [])
    .filter((item) => !item.userId || String(item.userId) === String(userId) || String(state.user?.id) === String(userId) || state.user?.email)
    .filter((item) => !existing.has(`${item.name}|${item.startDate}|${item.endDate}`.toLowerCase()))
    .map((item) => ({ ...item, id: `local-${item.id}`, localOnly: true }));
  return [...supabaseRows, ...localRows];
}

async function importLocalFinanceData(supabase, userId) {
  const migrationKey = `${SUPABASE_MIGRATION_KEY_PREFIX}${userId}`;
  if (localStorage.getItem(migrationKey)) return;
  const state = localDatabaseSnapshot();
  const hasLocalData = Boolean(
    state.expenses?.length ||
    state.subscriptions?.length ||
    state.events?.length ||
    Number(state.budget?.monthlyLimit || 0) > 0
  );
  if (!hasLocalData) {
    localStorage.setItem(migrationKey, "empty");
    return;
  }

  try {
    const categories = await loadCategories(supabase, userId);
    const { data: existingExpenseRows, error: expenseLookupError } = await supabase
      .from("spendly_expenses")
      .select("*")
      .eq("user_id", userId);
    if (expenseLookupError) throw expenseLookupError;
    const existingExpenseKeys = new Set((existingExpenseRows || []).map((row) => sameExpenseKey(normalizeExpense(row))));
    const localExpenses = (state.expenses || [])
      .filter((item) => !existingExpenseKeys.has(sameExpenseKey(item)))
      .map((item) => {
        const category = categoryById(categories, item.categoryId) || categories.find((row) => row.name === item.category) || defaultCategories[0];
        return {
          user_id: userId,
          category_id: category.id,
          category_name: item.category || category.name,
          category_color: item.categoryColor || category.color,
          amount: Number(item.amount || 0),
          spent_on: item.date,
          note: item.note || "",
          payment_method: item.paymentMethod || "other",
          event_id: null,
          event_name: item.eventName || null
        };
      });
    if (localExpenses.length) {
      const { error } = await supabase.from("spendly_expenses").insert(localExpenses);
      if (error) throw error;
    }

    const { data: budgetRow, error: budgetLookupError } = await supabase
      .from("spendly_budget_settings")
      .select("monthly_limit")
      .eq("user_id", userId)
      .maybeSingle();
    if (budgetLookupError) throw budgetLookupError;
    if (!Number(budgetRow?.monthly_limit || 0) && Number(state.budget?.monthlyLimit || 0) > 0) {
      const { error } = await supabase
        .from("spendly_budget_settings")
        .upsert({ user_id: userId, monthly_limit: Number(state.budget.monthlyLimit || 0), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    }

    const { data: existingSubscriptions, error: subscriptionLookupError } = await supabase
      .from("spendly_subscriptions")
      .select("name")
      .eq("user_id", userId);
    if (subscriptionLookupError) throw subscriptionLookupError;
    const existingSubscriptionNames = new Set((existingSubscriptions || []).map((item) => item.name.trim().toLowerCase()));
    const localSubscriptions = (state.subscriptions || [])
      .filter((item) => !existingSubscriptionNames.has(`${item.name}`.trim().toLowerCase()))
      .map((item) => {
        const category = categoryById(categories, item.categoryId) || categories.find((row) => row.name === item.category) || defaultCategories.find((row) => row.name === "Subscriptions") || defaultCategories[0];
        return {
          user_id: userId,
          name: item.name,
          amount: Number(item.amount || 0),
          category_id: category.id,
          category_name: item.category || category.name,
          category_color: item.categoryColor || category.color,
          billing_day: Number(item.billingDay || 1),
          interval_months: Number(item.intervalMonths || 1),
          payment_method: item.paymentMethod || "other",
          active: Boolean(item.active ?? true),
          notes: item.notes || ""
        };
      });
    if (localSubscriptions.length) {
      const { error } = await supabase.from("spendly_subscriptions").insert(localSubscriptions);
      if (error) throw error;
    }

    const { data: existingEvents, error: eventLookupError } = await supabase
      .from("spendly_events")
      .select("name,start_date,end_date")
      .eq("user_id", userId);
    if (eventLookupError) throw eventLookupError;
    const existingEventKeys = new Set((existingEvents || []).map((item) => `${item.name}|${item.start_date}|${item.end_date}`.toLowerCase()));
    const localEvents = (state.events || [])
      .filter((item) => !existingEventKeys.has(`${item.name}|${item.startDate}|${item.endDate}`.toLowerCase()))
      .map((item) => ({
        user_id: userId,
        name: item.name,
        type: item.type || "Other",
        start_date: item.startDate,
        end_date: item.endDate,
        budget_amount: Number(item.budgetAmount || 0),
        notes: item.notes || "",
        category: item.category || "Food",
        completed: Boolean(item.completed)
      }));
    if (localEvents.length) {
      const { error } = await supabase.from("spendly_events").insert(localEvents);
      if (error) throw error;
    }

    localStorage.setItem(migrationKey, "true");
  } catch (error) {
    console.warn("Spendly local-to-Supabase import skipped:", error);
  }
}

async function loadCategories(supabase, userId) {
  const { data, error } = await supabase
    .from("spendly_categories")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  const custom = (data || []).map((row) => ({
    id: row.category_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isCustom: row.is_custom
  }));
  const existing = new Set(defaultCategories.map((item) => item.name.toLowerCase()));
  return [...defaultCategories, ...custom.filter((item) => !existing.has(item.name.toLowerCase()))];
}

function filterExpenses(rows, params = {}) {
  return rows
    .filter((item) => !params.from || item.date >= params.from)
    .filter((item) => !params.to || item.date <= params.to)
    .filter((item) => !params.categoryId || String(item.categoryId) === String(params.categoryId))
    .filter((item) => !params.paymentMethod || item.paymentMethod === params.paymentMethod)
    .filter((item) => !params.search || item.note.toLowerCase().includes(String(params.search).toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
}

function monthBounds(value = month()) {
  const [year, monthNumber] = value.split("-").map(Number);
  const end = new Date(year, monthNumber, 0).getDate();
  return { start: `${value}-01`, end: `${value}-${String(end).padStart(2, "0")}`, days: end };
}

function buildSummary(expenses, budget, categories, selectedMonth = month()) {
  const bounds = monthBounds(selectedMonth);
  const monthRows = expenses.filter((item) => item.date >= bounds.start && item.date <= bounds.end);
  const total = monthRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const todayRows = expenses.filter((item) => item.date === today());
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const categoryRows = categories
    .map((category) => {
      const categoryTotal = monthRows.filter((item) => String(item.categoryId) === String(category.id) || item.category === category.name).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return { ...category, total: categoryTotal, percent: total ? Math.round((categoryTotal / total) * 10000) / 100 : 0 };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
  const trend = Object.values(
    monthRows.reduce((acc, item) => {
      if (!acc[item.date]) acc[item.date] = { date: item.date, total: 0 };
      acc[item.date].total += Number(item.amount || 0);
      return acc;
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date));
  const remaining = Math.max(0, Number(budget.monthlyLimit || 0) - total);
  const daysRemaining = Math.max(1, bounds.days - Number(today().slice(8, 10)) + 1);
  return {
    month: selectedMonth,
    dailyTotal: todayRows.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    weeklyTotal: expenses.filter((item) => item.date >= weekStartIso).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    monthlyTotal: total,
    monthlyBudget: Number(budget.monthlyLimit || 0),
    remainingBudget: remaining,
    budgetUsedPercent: budget.monthlyLimit ? Math.round((total / Number(budget.monthlyLimit)) * 10000) / 100 : 0,
    safeToSpendPerDay: Number((remaining / daysRemaining).toFixed(2)),
    daysRemaining,
    budgetStatus: total > budget.monthlyLimit ? "over" : total > budget.monthlyLimit * 0.85 ? "near" : "ok",
    categories: categoryRows,
    trend
  };
}

function buildAdvice(expenses, budget, categories, selectedMonth = month()) {
  const summary = buildSummary(expenses, budget, categories, selectedMonth);
  const highest = summary.categories[0];
  const notes = expenses.filter((item) => item.date.startsWith(selectedMonth) && item.note);
  const foodNotes = notes.filter((item) => /food|lunch|dinner|coffee|burger|snack|dal|chawal/i.test(item.note));
  const noteInsights = foodNotes.length
    ? [{ topic: "outside_food", label: "Food notes", count: foodNotes.length, amount: foodNotes.reduce((sum, item) => sum + Number(item.amount || 0), 0), message: "Your notes mention bought meals or snacks. Try setting a weekly cafe/order cap." }]
    : [];
  return {
    advice: {
      summary: highest ? `${highest.name} is your highest spending area this month.` : "No spending recorded for this month yet.",
      highestCategory: highest ? { category: highest.name, amount: highest.total, percentOfSpend: highest.percent } : null,
      safeToSpend: { totalRemaining: summary.remainingBudget, perDay: summary.safeToSpendPerDay, daysRemaining: summary.daysRemaining, status: summary.budgetStatus },
      alerts: [{ level: summary.budgetStatus === "over" ? "critical" : "normal", message: summary.budgetStatus === "over" ? "You have exceeded your monthly budget." : "Your spending is within the expected range." }],
      suggestions: noteInsights.length ? [noteInsights[0].message, "Review recent purchases and mark which ones were necessary."] : ["Set a small buffer for unplanned expenses."],
      noteInsights,
      weeklyTip: noteInsights.length ? "Pick two low-cost meal swaps this week." : "Plan one no-spend day this week."
    }
  };
}

async function loadExpenses(supabase, userId) {
  const { data, error } = await supabase
    .from("spendly_expenses")
    .select("*")
    .eq("user_id", userId)
    .order("spent_on", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return mergeLocalExpenses(userId, (data || []).map(normalizeExpense));
}

async function loadBudget(supabase, userId) {
  const { data, error } = await supabase
    .from("spendly_budget_settings")
    .select("monthly_limit")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const localBudget = Number(localDatabaseSnapshot().budget?.monthlyLimit || 0);
  return { monthlyLimit: Number(data?.monthly_limit || localBudget || 0) };
}

async function loadGoal(supabase, userId) {
  const { data, error } = await supabase
    .from("spendly_savings_goals")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const goal = {
    name: data?.name || "",
    targetAmount: Number(data?.target_amount || 0),
    currentAmount: Number(data?.current_amount || 0),
    targetDate: data?.target_date || ""
  };
  return {
    ...goal,
    progressPercent: goal.targetAmount ? Math.round((goal.currentAmount / goal.targetAmount) * 10000) / 100 : 0
  };
}

async function loadSubscriptions(supabase, userId) {
  const { data, error } = await supabase
    .from("spendly_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("billing_day", { ascending: true });
  if (error) throw error;
  return mergeLocalSubscriptions(userId, (data || []).map(normalizeSubscription));
}

async function loadEvents(supabase, userId) {
  const { data, error } = await supabase
    .from("spendly_events")
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return mergeLocalEvents(userId, (data || []).map(normalizeEvent));
}

export const supabaseApi = {
  async get(path, config = {}) {
    const { supabase, user } = await requireSupabaseUser();
    const params = config.params || {};
    if (path === "/auth/local") return response({ user, token: "supabase-session" });
    if (path === "/categories") return response({ categories: await loadCategories(supabase, user.id) });
    if (path === "/expenses") return response({ expenses: filterExpenses(await loadExpenses(supabase, user.id), params) });
    if (path === "/budget") return response(await loadBudget(supabase, user.id));
    if (path === "/savings-goal") return response({ goal: await loadGoal(supabase, user.id) });
    if (path === "/subscriptions") return response({ subscriptions: await loadSubscriptions(supabase, user.id) });
    if (path === "/events") return response({ events: await loadEvents(supabase, user.id) });
    if (path === "/summary") {
      const [expenses, budget, categories] = await Promise.all([loadExpenses(supabase, user.id), loadBudget(supabase, user.id), loadCategories(supabase, user.id)]);
      return response({ summary: buildSummary(expenses, budget, categories, params.month || month()) });
    }
    if (path === "/advice") {
      const [expenses, budget, categories] = await Promise.all([loadExpenses(supabase, user.id), loadBudget(supabase, user.id), loadCategories(supabase, user.id)]);
      return response(buildAdvice(expenses, budget, categories, params.month || month()));
    }
    if (path.startsWith("/export.csv")) {
      const rows = filterExpenses(await loadExpenses(supabase, user.id), params);
      const csv = ["date,category,note,payment_method,amount", ...rows.map((item) => [item.date, item.category, `"${item.note.replaceAll('"', '""')}"`, item.paymentMethod, item.amount].join(","))].join("\n");
      return response(new Blob([csv], { type: "text/csv" }));
    }
    throw new Error(`Unsupported Supabase API route: ${path}`);
  },
  async post(path, payload) {
    const { supabase, user } = await requireSupabaseUser();
    const categories = await loadCategories(supabase, user.id);
    if (path === "/expenses") {
      const category = categoryById(categories, payload.categoryId);
      const { data, error } = await supabase
        .from("spendly_expenses")
        .insert({
          user_id: user.id,
          category_id: category.id,
          category_name: category.name,
          category_color: category.color,
          amount: Number(payload.amount || 0),
          spent_on: payload.date,
          note: payload.note || "",
          payment_method: payload.paymentMethod || "other",
          event_id: payload.eventId || null,
          event_name: payload.eventName || null
        })
        .select()
        .single();
      if (error) throw error;
      return response({ expense: normalizeExpense(data) });
    }
    if (path === "/subscriptions") {
      const category = categoryById(categories, payload.categoryId);
      const { data, error } = await supabase
        .from("spendly_subscriptions")
        .insert({
          user_id: user.id,
          name: payload.name,
          amount: Number(payload.amount || 0),
          category_id: category.id,
          category_name: category.name,
          category_color: category.color,
          billing_day: Number(payload.billingDay || 1),
          interval_months: Number(payload.intervalMonths || 1),
          payment_method: payload.paymentMethod || "other",
          active: Boolean(payload.active ?? true)
        })
        .select()
        .single();
      if (error) throw error;
      return response({ subscription: normalizeSubscription(data) });
    }
    if (path === "/events") {
      const { data, error } = await supabase
        .from("spendly_events")
        .insert({
          user_id: user.id,
          name: payload.name,
          type: payload.type || "Other",
          start_date: payload.startDate,
          end_date: payload.endDate,
          budget_amount: Number(payload.budgetAmount || 0),
          notes: payload.notes || "",
          category: payload.category || "Food",
          completed: Boolean(payload.completed)
        })
        .select()
        .single();
      if (error) throw error;
      return response({ event: normalizeEvent(data) });
    }
    throw new Error(`Unsupported Supabase API route: ${path}`);
  },
  async put(path, payload) {
    const { supabase, user } = await requireSupabaseUser();
    const categories = await loadCategories(supabase, user.id);
    const expenseMatch = path.match(/^\/expenses\/(\d+)$/);
    const subscriptionMatch = path.match(/^\/subscriptions\/(\d+)$/);
    const eventMatch = path.match(/^\/events\/([0-9a-f-]+)$/i);
    if (expenseMatch) {
      const category = categoryById(categories, payload.categoryId);
      const { data, error } = await supabase
        .from("spendly_expenses")
        .update({
          category_id: category.id,
          category_name: category.name,
          category_color: category.color,
          amount: Number(payload.amount || 0),
          spent_on: payload.date,
          note: payload.note || "",
          payment_method: payload.paymentMethod || "other",
          event_id: payload.eventId || null,
          event_name: payload.eventName || null
        })
        .eq("user_id", user.id)
        .eq("id", Number(expenseMatch[1]))
        .select()
        .single();
      if (error) throw error;
      return response({ expense: normalizeExpense(data) });
    }
    if (path === "/budget") {
      const { data, error } = await supabase
        .from("spendly_budget_settings")
        .upsert({ user_id: user.id, monthly_limit: Number(payload.monthlyLimit || 0), updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .select("monthly_limit")
        .single();
      if (error) throw error;
      return response({ monthlyLimit: Number(data?.monthly_limit || 0) });
    }
    if (path === "/savings-goal") {
      const { data, error } = await supabase
        .from("spendly_savings_goals")
        .upsert({
          user_id: user.id,
          name: payload.name || "",
          target_amount: Number(payload.targetAmount || 0),
          current_amount: Number(payload.currentAmount || 0),
          target_date: payload.targetDate || null,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      const goal = await loadGoal(supabase, data.user_id);
      return response({ goal });
    }
    if (subscriptionMatch) {
      const category = categoryById(categories, payload.categoryId);
      const { data, error } = await supabase
        .from("spendly_subscriptions")
        .update({
          name: payload.name,
          amount: Number(payload.amount || 0),
          category_id: category.id,
          category_name: category.name,
          category_color: category.color,
          billing_day: Number(payload.billingDay || 1),
          interval_months: Number(payload.intervalMonths || 1),
          payment_method: payload.paymentMethod || "other",
          active: Boolean(payload.active ?? true)
        })
        .eq("user_id", user.id)
        .eq("id", Number(subscriptionMatch[1]))
        .select()
        .single();
      if (error) throw error;
      return response({ subscription: normalizeSubscription(data) });
    }
    if (eventMatch) {
      const { data, error } = await supabase
        .from("spendly_events")
        .update({
          name: payload.name,
          type: payload.type || "Other",
          start_date: payload.startDate,
          end_date: payload.endDate,
          budget_amount: Number(payload.budgetAmount || 0),
          notes: payload.notes || "",
          category: payload.category || "Food",
          completed: Boolean(payload.completed),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id)
        .eq("id", eventMatch[1])
        .select()
        .single();
      if (error) throw error;
      return response({ event: normalizeEvent(data) });
    }
    throw new Error(`Unsupported Supabase API route: ${path}`);
  },
  async delete(path) {
    const { supabase, user } = await requireSupabaseUser();
    const expenseMatch = path.match(/^\/expenses\/(\d+)$/);
    const subscriptionMatch = path.match(/^\/subscriptions\/(\d+)$/);
    const eventMatch = path.match(/^\/events\/([0-9a-f-]+)$/i);
    if (expenseMatch) {
      const { error } = await supabase.from("spendly_expenses").delete().eq("user_id", user.id).eq("id", Number(expenseMatch[1]));
      if (error) throw error;
      return response({});
    }
    if (subscriptionMatch) {
      const { error } = await supabase.from("spendly_subscriptions").delete().eq("user_id", user.id).eq("id", Number(subscriptionMatch[1]));
      if (error) throw error;
      return response({});
    }
    if (eventMatch) {
      const { error } = await supabase.from("spendly_events").delete().eq("user_id", user.id).eq("id", eventMatch[1]);
      if (error) throw error;
      return response({});
    }
    throw new Error(`Unsupported Supabase API route: ${path}`);
  }
};
