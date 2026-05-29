import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, BarChart3, Bell, Bot, CalendarClock, CalendarRange, Check, Crown, Grid2X2, PiggyBank, Plus, ReceiptText, Repeat, Settings, TrendingUp, WalletCards, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, XAxis, YAxis } from "recharts";
import AdvicePanel from "./components/AdvicePanel.jsx";
import { LoginPage, SignupPage } from "./components/AuthPages.jsx";
import BudgetPage from "./components/BudgetPage.jsx";
import BudgetPanel from "./components/BudgetPanel.jsx";
import CategoryBadge, { getCategoryMeta } from "./components/CategoryBadge.jsx";
import { CategoryChart, TrendChart } from "./components/Charts.jsx";
import EventsPage from "./components/EventsPage.jsx";
import LandingPage from "./components/LandingPage.jsx";
import OnboardingPage from "./components/OnboardingPage.jsx";
import StatCard from "./components/StatCard.jsx";
import SubscriptionManagerPage from "./components/SubscriptionManagerPage.jsx";
import SpendlyLogo from "./components/SpendlyLogo.jsx";
import SpendlyLoader from "./components/SpendlyLoader.jsx";
import SpendlyConfirmHost from "./components/SpendlyConfirm.jsx";
import { api, readUser, saveSession } from "./services/api.js";
import { confirmSpendly } from "./services/confirmDialog.js";
import { formatCurrency } from "./services/currency.js";
import { addMonths, buildCalendarDays, formatMonthLabel, localDateString, localMonthString, monthBounds } from "./services/dates.js";
import { mergeSpendlyCategories } from "./services/categories.js";
import { enrichExpensesWithEvents, eventStats, removeEventLinks } from "./services/events.js";
import { getCurrentSupabaseUser, getOnboarding, getSessionUser, isOnboardingComplete, logoutUser, redoOnboarding } from "./services/localAuth.js";
import { isSupabaseEnabled } from "./services/supabaseClient.js";

const emptySummary = {
  dailyTotal: 0,
  weeklyTotal: 0,
  monthlyTotal: 0,
  monthlyBudget: 0,
  remainingBudget: 0,
  budgetUsedPercent: 0,
  safeToSpendPerDay: 0,
  daysRemaining: 1,
  budgetStatus: "ok",
  categories: [],
  trend: []
};

const emptyAdvice = {
  alerts: [],
  suggestions: [],
  safeToSpend: { perDay: 0, daysRemaining: 0 },
  weeklyTip: "Plan one no-spend day this week."
};

const monthValue = localMonthString();
const SIDEBAR_ORDER_KEY = "spendly_sidebar_order";
const BUDGET_CATEGORIES_KEY = "spendly_budget_categories";
const SPENDLY_CATEGORIES_KEY = "spendly_categories";
const HIDDEN_BUDGET_ROWS_KEY = "spendly_hidden_budget_rows";

const defaultSidebarItems = [
  { id: "dashboard", label: "Dashboard", icon: Grid2X2, path: "/dashboard" },
  { id: "spending", label: "Spending", icon: WalletCards, path: "/spending" },
  { id: "events", label: "Events", icon: CalendarRange, path: "/events" },
  { id: "budget", label: "Budget", icon: PiggyBank, path: "/budget" },
  { id: "subscriptions", label: "Recurring", icon: Repeat, path: "/subscriptions" },
  { id: "reports", label: "Reports", icon: BarChart3, path: "/reports" }
];

const addSpendingCategoryNames = [
  "Food",
  "Transport",
  "Bills & Utilities",
  "Rent / Housing",
  "Education",
  "Health",
  "Shopping",
  "Entertainment",
  "Subscriptions",
  "Savings",
  "Travel",
  "Other"
];

const addSpendingCategoryFallbacks = {
  Food: { id: 10, color: "#f97316" },
  Transport: { id: 1, color: "#0ea5e9" },
  "Bills & Utilities": { id: 11, color: "#10b981" },
  "Rent / Housing": { id: 12, color: "#f59e0b" },
  Education: { id: 13, color: "#ec4899" },
  Health: { id: 6, color: "#ef4444" },
  Shopping: { id: 7, color: "#f59e0b" },
  Entertainment: { id: 5, color: "#d946ef" },
  Subscriptions: { id: 8, color: "#8b5cf6" },
  Savings: { id: 14, color: "#22c55e" },
  Travel: { id: 15, color: "#eab308" },
  Other: { id: 9, color: "#475569" }
};

function readSidebarItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(SIDEBAR_ORDER_KEY) || "[]");
    if (!Array.isArray(saved) || saved.length === 0) return defaultSidebarItems;
    const itemMap = new Map(defaultSidebarItems.map((item) => [item.id, item]));
    const ordered = saved.map((id) => itemMap.get(id)).filter(Boolean);
    const missing = defaultSidebarItems.filter((item) => !saved.includes(item.id));
    return [...ordered, ...missing];
  } catch {
    return defaultSidebarItems;
  }
}

function saveSidebarItems(items) {
  localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(items.map((item) => item.id)));
}

function resetSidebarOrder() {
  localStorage.removeItem(SIDEBAR_ORDER_KEY);
  window.dispatchEvent(new CustomEvent("spendly-sidebar-reset"));
}

function navigateTo(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [appUser, setAppUser] = useState(getSessionUser());
  const [onboarded, setOnboarded] = useState(isOnboardingComplete());
  const [authChecking, setAuthChecking] = useState(isSupabaseEnabled());

  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => {
    let active = true;
    async function restoreSupabaseSession() {
      if (!isSupabaseEnabled()) {
        setAuthChecking(false);
        return;
      }
      try {
        const result = await getCurrentSupabaseUser();
        if (!active) return;
        if (result?.user) {
          setAppUser(result.user);
          setOnboarded(Boolean(result.onboardingComplete));
        }
      } finally {
        if (active) setAuthChecking(false);
      }
    }
    restoreSupabaseSession();
    return () => {
      active = false;
    };
  }, []);

  function go(nextPath) {
    navigateTo(nextPath);
  }

  function finishAuth(nextUser, target = "/dashboard", onboardingComplete = isOnboardingComplete()) {
    setAppUser(nextUser);
    setOnboarded(Boolean(onboardingComplete));
    go(target);
  }

  function completeOnboarding() {
    setOnboarded(true);
    go("/dashboard");
  }

  async function logout() {
    await logoutUser();
    setAppUser(null);
    setOnboarded(false);
    go("/");
  }

  async function restartOnboarding() {
    await redoOnboarding();
    setOnboarded(false);
    go("/onboarding");
  }

  if (authChecking && path !== "/auth/callback") {
    return <SpendlyLoader show message="Securing your budget space..." />;
  }

  if (path === "/login") {
    if (appUser && onboarded) {
      go("/dashboard");
      return null;
    }
    return <LoginPage onNavigate={go} onLogin={(nextUser, onboardingComplete) => finishAuth(nextUser, onboardingComplete ? "/dashboard" : "/onboarding", onboardingComplete)} />;
  }

  if (path === "/signup") {
    if (appUser && onboarded) {
      go("/dashboard");
      return null;
    }
    return <SignupPage onNavigate={go} onSignup={(nextUser) => finishAuth(nextUser, "/onboarding", false)} />;
  }

  if (path === "/auth/callback") {
    return <AuthCallbackPage onComplete={(result) => finishAuth(result.user, result.onboardingComplete ? "/dashboard" : "/onboarding", result.onboardingComplete)} onNavigate={go} />;
  }

  if (path === "/onboarding") {
    if (!appUser) {
      go("/login");
      return null;
    }
    return <OnboardingPage user={appUser} onComplete={completeOnboarding} />;
  }

  if (path === "/dashboard") {
    if (!appUser) {
      go("/login");
      return null;
    }
    if (!onboarded) {
      go("/onboarding");
      return null;
    }
    return <Dashboard appUser={appUser} onLogout={logout} onNavigate={go} activePath={path} />;
  }

  if (path === "/expenses") {
    go(appUser ? "/dashboard" : "/login");
    return null;
  }

  if (path === "/split-bills") {
    go(appUser ? "/dashboard" : "/login");
    return null;
  }

  const protectedPages = ["/spending", "/reports/spending", "/events", "/budget", "/savings", "/subscriptions", "/reports", "/settings", "/preferences"];
  if (protectedPages.includes(path)) {
    if (!appUser) {
      go("/login");
      return null;
    }
    if (!onboarded) {
      go("/onboarding");
      return null;
    }
    if (path === "/settings" || path === "/preferences") return <PreferencesPage user={appUser} onBack={() => go("/dashboard")} onLogout={logout} onRedoOnboarding={restartOnboarding} />;
    return <Dashboard appUser={appUser} onLogout={logout} onNavigate={go} activePath={path} />;
  }

  return <LandingPage onNavigate={go} />;
}

function AuthCallbackPage({ onComplete, onNavigate }) {
  const [message, setMessage] = useState("Preparing your dashboard...");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function finishCallback() {
      try {
        const result = await getCurrentSupabaseUser();
        if (!active) return;
        if (!result?.user) {
          onNavigate("/login");
          return;
        }
        setMessage(result.onboardingComplete ? "Preparing your dashboard..." : "Personalizing your setup...");
        window.setTimeout(() => {
          if (active) onComplete(result);
        }, 1000);
      } catch (err) {
        if (!active) return;
        setError(err.message || "Could not complete Supabase login.");
        window.setTimeout(() => onNavigate("/login"), 1400);
      }
    }
    finishCallback();
    return () => {
      active = false;
    };
  }, [onComplete, onNavigate]);

  return (
    <>
      <SpendlyLoader show message={message} />
      {error && (
        <div className="fixed inset-x-0 top-6 z-[10000] mx-auto w-fit rounded-2xl bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-100">
          {error}
        </div>
      )}
    </>
  );
}

function Dashboard({ appUser, onLogout, onNavigate, activePath = "/dashboard" }) {
  const [user, setUser] = useState(readUser());
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [calendarExpenses, setCalendarExpenses] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [events, setEvents] = useState([]);
  const [lastMonthExpenses, setLastMonthExpenses] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [advice, setAdvice] = useState(emptyAdvice);
  const [budget, setBudget] = useState({ monthlyLimit: 0 });
  const [budgetSyncVersion, setBudgetSyncVersion] = useState(0);
  const [goal, setGoal] = useState({ name: "", targetAmount: 0, currentAmount: 0, progressPercent: 0 });
  const [editing, setEditing] = useState(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(monthValue);
  const [selectedDate, setSelectedDate] = useState(localDateString());
  const [filters, setFilters] = useState({
    from: `${monthValue}-01`,
    to: "",
    categoryId: "",
    paymentMethod: "",
    search: ""
  });

  const queryFilters = useMemo(() => {
    const clean = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) clean[key] = value;
    });
    return clean;
  }, [filters]);

  const startLocalSession = useCallback(async () => {
    const response = await api.get("/auth/local");
    saveSession(response.data);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  useEffect(() => {
    let active = true;
    async function bootLocalProfile() {
      try {
        const response = await api.get("/auth/local");
        if (!active) return;
        saveSession(response.data);
        setUser(response.data.user);
      } catch (err) {
        if (active) setError(err.response?.data?.error?.message || "Could not open the local student profile.");
      } finally {
        if (active) setBooting(false);
      }
    }
    bootLocalProfile();
    return () => {
      active = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const calendarRange = monthBounds(calendarMonth);
      const lastMonthRange = monthBounds(addMonths(calendarMonth, -1));
      const [categoryRes, expenseRes, allExpenseRes, summaryRes, adviceRes, budgetRes, goalRes, subscriptionRes, eventRes, calendarExpenseRes, lastMonthExpenseRes] = await Promise.all([
        api.get("/categories"),
        api.get("/expenses", { params: queryFilters }),
        api.get("/expenses"),
        api.get("/summary", { params: { month: calendarMonth } }),
        api.get("/advice", { params: { month: calendarMonth } }),
        api.get("/budget"),
        api.get("/savings-goal"),
        api.get("/subscriptions"),
        api.get("/events"),
        api.get("/expenses", { params: { from: calendarRange.start, to: calendarRange.end } }),
        api.get("/expenses", { params: { from: lastMonthRange.start, to: lastMonthRange.end } })
      ]);
      const onboarding = getOnboarding();
      const mergedCategories = mergeSpendlyCategories(categoryRes.data.categories);
      const selectedCategoryNames = new Set(onboarding?.categories || []);
      const nextCategories = selectedCategoryNames.size
        ? mergedCategories.filter((category) => selectedCategoryNames.has(category.name) || category.isCustom)
        : mergedCategories;
      const monthlyBudget = Number(onboarding?.monthlyBudget || 0);
      const nextSummary = monthlyBudget > 0 ? applyOnboardingBudget(summaryRes.data.summary, monthlyBudget) : summaryRes.data.summary;
      const nextGoal = onboarding?.goalName
        ? {
            ...goalRes.data.goal,
            name: onboarding.goalName,
            targetAmount: Number(onboarding.goalTargetAmount || goalRes.data.goal.targetAmount),
            targetDate: onboarding.targetDate || goalRes.data.goal.targetDate,
            progressPercent: goalRes.data.goal.currentAmount && onboarding.goalTargetAmount
              ? Math.round((goalRes.data.goal.currentAmount / Number(onboarding.goalTargetAmount)) * 10000) / 100
              : goalRes.data.goal.progressPercent
          }
        : goalRes.data.goal;
      const onboardingSubscriptions = (onboarding?.subscriptions || []).map((item, index) => ({
        id: `onboarding-${index}`,
        name: item.name,
        amount: Number(item.amount || 0),
        billingDay: Number(item.billingDay || 1),
        intervalMonths: Number(item.billingCycle || item.intervalMonths || 1),
        paymentMethod: "other",
        active: true,
        readOnly: true
      }));
      setCategories(nextCategories);
      const nextExpenses = enrichExpensesWithEvents(expenseRes.data.expenses);
      const nextAllExpenses = enrichExpensesWithEvents(allExpenseRes.data.expenses);
      const nextCalendarExpenses = enrichExpensesWithEvents(calendarExpenseRes.data.expenses);
      const nextLastMonthExpenses = enrichExpensesWithEvents(lastMonthExpenseRes.data.expenses);
      setExpenses(nextExpenses);
      setAllExpenses(nextAllExpenses);
      setSummary(nextSummary);
      setAdvice(adviceRes.data.advice);
      setBudget(monthlyBudget > 0 ? { ...budgetRes.data, monthlyLimit: monthlyBudget } : budgetRes.data);
      setGoal(nextGoal);
      setSubscriptions([...onboardingSubscriptions, ...subscriptionRes.data.subscriptions]);
      setCalendarExpenses(nextCalendarExpenses);
      setLastMonthExpenses(nextLastMonthExpenses);
      setEvents(eventRes.data.events || []);
    } catch (err) {
      if (err.response?.status === 401) {
        try {
          await startLocalSession();
          setError("");
        } catch (sessionErr) {
          setError(sessionErr.response?.data?.error?.message || "Could not reopen the local student profile.");
        }
      } else {
        setError(err.response?.data?.error?.message || err.message || "Could not load dashboard data.");
      }
    } finally {
      setLoading(false);
    }
  }, [calendarMonth, queryFilters, startLocalSession, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    window.addEventListener("spendly-categories-updated", loadData);
    return () => window.removeEventListener("spendly-categories-updated", loadData);
  }, [loadData]);

  useEffect(() => {
    const syncEvents = () => {
      loadData();
    };
    window.addEventListener("spendly-events-updated", syncEvents);
    return () => window.removeEventListener("spendly-events-updated", syncEvents);
  }, [loadData]);

  useEffect(() => {
    const syncBudgetRows = () => setBudgetSyncVersion((version) => version + 1);
    window.addEventListener("spendly-budget-updated", syncBudgetRows);
    window.addEventListener("storage", syncBudgetRows);
    return () => {
      window.removeEventListener("spendly-budget-updated", syncBudgetRows);
      window.removeEventListener("storage", syncBudgetRows);
    };
  }, []);

  async function saveExpense(payload) {
    setError("");
    try {
      let savedExpense;
      if (editing) {
        const result = await api.put(`/expenses/${editing.id}`, payload);
        savedExpense = result.data.expense;
      } else {
        const result = await api.post("/expenses", payload);
        savedExpense = result.data.expense;
      }
      setEditing(null);
      await loadData();
      return savedExpense;
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not save expense.");
      return null;
    }
  }

  async function deleteExpense(id) {
    setError("");
    try {
      await api.delete(`/expenses/${id}`);
      removeEventLinks([id]);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not delete expense.");
    }
  }

  async function deleteCategorySpending(categoryName) {
    const matching = calendarExpenses.filter((expense) => expense.category === categoryName);
    if (matching.length === 0) {
      window.alert("No saved spending entries were found for this category. Recurring planned charges should be managed from the Recurring page.");
      return;
    }
    const total = matching.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const confirmed = await confirmSpendly({
      title: `Remove ${categoryName} spending?`,
      message: `This will remove ${matching.length} entr${matching.length === 1 ? "y" : "ies"} totaling ${formatCurrency(total)} from this month.`,
      confirmLabel: "Remove",
      tone: "danger"
    });
    if (!confirmed) return;
    setError("");
    try {
      await Promise.all(matching.map((expense) => api.delete(`/expenses/${expense.id}`)));
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not remove category spending.");
    }
  }

  async function saveBudget(monthlyLimit) {
    await api.put("/budget", { monthlyLimit });
    await loadData();
  }

  async function saveGoal(nextGoal) {
    await api.put("/savings-goal", nextGoal);
    await loadData();
  }

  async function createSubscription(payload) {
    await api.post("/subscriptions", payload);
    await loadData();
  }

  async function updateSubscription(id, payload) {
    await api.put(`/subscriptions/${id}`, payload);
    await loadData();
  }

  async function deleteSubscription(id) {
    await api.delete(`/subscriptions/${id}`);
    await loadData();
  }

  async function createEvent(payload) {
    const result = await api.post("/events", payload);
    await loadData();
    return result.data.event;
  }

  async function updateEvent(id, payload) {
    const result = await api.put(`/events/${id}`, payload);
    await loadData();
    return result.data.event;
  }

  async function deleteEvent(id, { deleteLinkedExpenses = false } = {}) {
    setError("");
    try {
      const linked = allExpenses.filter((expense) => String(expense.eventId) === String(id));
      if (deleteLinkedExpenses) {
        await Promise.all(linked.map((expense) => api.delete(`/expenses/${expense.id}`)));
        removeEventLinks(linked.map((expense) => expense.id));
      } else if (linked.length) {
        await Promise.all(linked.map((expense) => api.put(`/expenses/${expense.id}`, {
          categoryId: expense.categoryId,
          amount: expense.amount,
          date: expense.date,
          note: expense.note,
          paymentMethod: expense.paymentMethod,
          eventId: null,
          eventName: null
        })));
        removeEventLinks(linked.map((expense) => expense.id));
      }
      await api.delete(`/events/${id}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || "Could not delete event.");
    }
  }

  async function saveEventExpense(payload, event) {
    setError("");
    try {
      await api.post("/expenses", {
        ...payload,
        note: payload.note || `${event.name} expense`,
        eventId: event.id,
        eventName: event.name
      });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || "Could not save event expense.");
    }
  }

  function changeCalendarMonth(delta) {
    const nextMonth = addMonths(calendarMonth, delta);
    setCalendarMonth(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
  }

  function jumpToToday() {
    const today = localDateString();
    setCalendarMonth(today.slice(0, 7));
    setSelectedDate(today);
  }

  function selectCalendarDate(date) {
    setSelectedDate(date);
    setCalendarMonth(date.slice(0, 7));
  }

  if (booting || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="card w-full max-w-sm p-5 text-center">
          <p className="text-sm font-semibold text-violet-300">Opening local student profile</p>
          <p className="mt-2 text-2xl font-bold tracking-normal">Loading budget tracker</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.22),transparent_32rem),linear-gradient(180deg,#070816_0%,#111827_48%,#070816_100%)] pb-24 text-slate-100 md:pb-6">
      <MobileNav activePath={activePath} onNavigate={onNavigate} />
      <div className="grid w-full gap-4 px-4 py-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:pl-0 lg:pr-6 md:px-6 md:py-6">
        <DashboardSidebar user={appUser || user} subscriptions={subscriptions} onLogout={onLogout} onNavigate={onNavigate} activePath={activePath} />
        <section className="min-w-0 space-y-4">
          <header className="flex min-h-16 items-center justify-between gap-3">
            {activePath === "/dashboard" ? (
              <div>
                <p className="text-sm font-medium text-slate-400">Welcome back</p>
                <h1 className="text-3xl font-black tracking-normal text-white">{timeGreeting()}, {firstName(appUser?.name || user.name)}</h1>
              </div>
            ) : (
              <div>
                <h1 className="text-3xl font-black tracking-normal text-white">{pageTitle(activePath, calendarMonth)}</h1>
                <p className="mt-2 text-sm text-slate-400">{pageDescription(activePath)}</p>
              </div>
            )}
          </header>

          {error && <div className="rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{error}</div>}

          {activePath === "/dashboard" && (
            <OverviewDashboard
              appUser={appUser}
              summary={summary}
              budgetSyncVersion={budgetSyncVersion}
              expenses={expenses}
              allExpenses={allExpenses}
              calendarExpenses={calendarExpenses}
              lastMonthExpenses={lastMonthExpenses}
              subscriptions={subscriptions}
              events={events}
              advice={advice}
              goal={goal}
              categories={categories}
              onAddSpending={saveExpense}
              onNavigate={onNavigate}
            />
          )}

          {(activePath === "/spending" || activePath === "/reports/spending") && (
            <SpendingAnalyticsPage
              summary={summary}
              expenses={calendarExpenses}
              lastMonthExpenses={lastMonthExpenses}
              subscriptions={subscriptions}
              calendarMonth={calendarMonth}
              selectedDate={selectedDate}
              onMonthChange={changeCalendarMonth}
              onToday={jumpToToday}
              onDateSelect={selectCalendarDate}
              onRemoveCategorySpending={deleteCategorySpending}
            />
          )}

          {activePath === "/events" && (
            <EventsPage
              user={appUser || user}
              categories={categories}
              expenses={allExpenses}
              events={events}
              onCreateEvent={createEvent}
              onUpdateEvent={updateEvent}
              onDeleteEvent={deleteEvent}
              onAddExpense={saveEventExpense}
              onDeleteExpense={deleteExpense}
            />
          )}

          {activePath === "/budget" && (
            <BudgetPage summary={summary} expenses={calendarExpenses} subscriptions={subscriptions} />
          )}

          {activePath === "/savings" && (
            <div className="mx-auto max-w-3xl">
              <BudgetPanel budget={budget} goal={goal} summary={summary} onBudgetSave={saveBudget} onGoalSave={saveGoal} />
            </div>
          )}

          {activePath === "/subscriptions" && (
            <SubscriptionManagerPage
              categories={categories}
              subscriptions={subscriptions}
              onCreate={createSubscription}
              onUpdate={updateSubscription}
              onDelete={deleteSubscription}
            />
          )}

          {activePath === "/reports" && (
            <ReportsPage summary={summary} expenses={calendarExpenses} events={events} advice={advice} />
          )}
        </section>
      </div>
      <SpendlyConfirmHost />
    </main>
  );
}

function OverviewDashboard({ appUser, summary, budgetSyncVersion, expenses, allExpenses = [], calendarExpenses, lastMonthExpenses, subscriptions, events = [], goal, categories, onAddSpending, onNavigate }) {
  const onboarding = getOnboarding();
  const monthlyIncome = Number(onboarding?.monthlyIncome || 0);
  const recurringTotal = subscriptions
    .filter((item) => item.active !== false)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const budgetCardSummary = useMemo(() => buildBudgetSyncedSummary(summary, recurringTotal), [summary, recurringTotal, budgetSyncVersion]);
  const monthDelta = summary.monthlyTotal - lastMonthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const activeEvent = events
    .map((event) => ({ ...event, stats: eventStats(event, allExpenses) }))
    .find((event) => event.stats.status === "Active");
  const comparison = monthDelta >= 0
    ? `You spent ${formatCurrency(monthDelta)} more than last month`
    : `You spent ${formatCurrency(Math.abs(monthDelta))} less than last month`;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
      <section className="space-y-4">
        <CurrentSpendCard
          total={summary.monthlyTotal}
          comparison={comparison}
          thisMonth={calendarExpenses}
          lastMonth={lastMonthExpenses}
        />
        <AddSpendingCard categories={categories} onAddSpending={onAddSpending} onNavigate={onNavigate} />
        <RecentTransactionsCard expenses={expenses} onNavigate={onNavigate} />
      </section>

      <aside className="space-y-4">
        <UpcomingCard subscriptions={subscriptions} onNavigate={onNavigate} />
        {activeEvent && <DashboardEventCard event={activeEvent} onNavigate={onNavigate} />}
        <BudgetSummaryCard income={monthlyIncome} summary={budgetCardSummary} recurringTotal={recurringTotal} onNavigate={onNavigate} />
      </aside>
    </div>
  );
}

function DashboardEventCard({ event, onNavigate }) {
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-violet-200">Active Event</p>
          <h2 className="mt-1 text-lg font-bold tracking-normal text-white">{event.name}</h2>
          <p className="mt-1 text-xs text-slate-500">{event.type} · {event.endDate}</p>
        </div>
        <CalendarRange className="text-violet-300" size={20} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white/8 p-3">
          <p className="text-[11px] font-semibold text-slate-500">Spent</p>
          <p className="mt-1 text-sm font-black">{formatCurrency(event.stats.totalSpent)}</p>
        </div>
        <div className="rounded-2xl bg-white/8 p-3">
          <p className="text-[11px] font-semibold text-slate-500">Remaining</p>
          <p className={`mt-1 text-sm font-black ${event.stats.remaining >= 0 ? "text-emerald-300" : "text-amber-300"}`}>{formatCurrency(event.stats.remaining)}</p>
        </div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-300" style={{ width: `${event.stats.usedPercentage}%` }} />
      </div>
      <button className="btn-soft mt-4 w-full justify-center" onClick={() => onNavigate("/events")}>View Events</button>
    </section>
  );
}

function CurrentSpendCard({ total, comparison, thisMonth, lastMonth }) {
  const data = buildSpendChartData(thisMonth, lastMonth);

  return (
    <section className="card p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-normal">Current Spend</h2>
          <p className="mt-2 text-4xl font-black tracking-normal text-white">{formatCurrency(total)}</p>
        </div>
        <p className={`rounded-full px-3 py-1 text-xs font-semibold ${comparison.includes("less") ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>
          {comparison}
        </p>
      </div>

      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="spendPurple" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={56} />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#f8fafc" }}
              labelStyle={{ color: "#f8fafc" }}
              itemStyle={{ color: "#f8fafc" }}
            />
            <Area type="monotone" dataKey="lastMonth" name="Last Month" stroke="#64748b" strokeDasharray="5 5" fill="transparent" strokeWidth={2} />
            <Area type="monotone" dataKey="thisMonth" name="This Month" stroke="#a78bfa" fill="url(#spendPurple)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex gap-5 text-xs font-semibold text-slate-400">
        <span className="flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-violet-300" />This Month</span>
        <span className="flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-slate-500" />Last Month</span>
      </div>
    </section>
  );
}

function RecentTransactionsCard({ expenses, onNavigate }) {
  const rows = expenses.slice(0, 6);
  const grouped = rows.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  return (
    <section className="card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-normal">Recent Transactions</h2>
        <button className="btn-soft px-3" onClick={() => onNavigate("/spending")}>See All Transactions</button>
      </div>
      <div className="mt-4 space-y-4">
        {rows.length === 0 ? (
          <p className="rounded-3xl bg-white/8 p-4 text-sm text-slate-400">No recent transactions yet.</p>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{formatReadableDate(date)}</p>
              <div className="divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/5">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 p-3">
                    <CategoryBadge category={item.category} size={40} iconSize={18} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-100">{item.note || item.category}</p>
                      <p className="truncate text-xs text-slate-500">{item.category} / {item.paymentMethod}</p>
                      {item.eventName && <p className="mt-1 w-fit rounded-full bg-violet-500/15 px-2 py-0.5 text-[0.65rem] font-bold text-violet-200">Event: {item.eventName}</p>}
                    </div>
                    <span className="text-sm font-bold tabular-nums text-slate-100">{formatCurrency(item.amount)}</span>
                    <button className="grid h-8 w-8 place-items-center rounded-2xl bg-white/8 text-slate-300 hover:bg-violet-500/15 hover:text-violet-100" onClick={() => onNavigate("/spending")} aria-label="View transaction">
                      <ArrowRight size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function UpcomingCard({ subscriptions, onNavigate }) {
  const days = nextSevenDays();
  const upcoming = days.map((day) => ({
    ...day,
    items: subscriptions.filter((item) => Number(item.billingDay) === day.dayNumber)
  }));
  const total = upcoming.flatMap((day) => day.items).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-normal">Upcoming</h2>
          <p className="mt-1 text-xs text-slate-400">Due within 7 days for {formatCurrency(total)}.</p>
        </div>
        <button className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">Next 7 days</button>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-2">
        {upcoming.map((day) => (
          <div key={day.iso} className="min-h-28 rounded-3xl border border-white/10 bg-white/5 p-2 text-center">
            <p className="text-[0.65rem] font-semibold text-slate-500">{day.label}</p>
            <p className="mt-1 text-sm font-black text-slate-100">{day.dayNumber}</p>
            <div className="mt-3 space-y-1">
              {day.items.slice(0, 2).map((item) => (
                <div key={`${item.id}-${day.iso}`} className="rounded bg-violet-500/15 px-1 py-1 text-[0.65rem] font-semibold text-violet-100">
                  {formatCurrency(item.amount)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className="btn-soft mt-4 w-full" onClick={() => onNavigate("/subscriptions")}>See All Upcoming</button>
    </section>
  );
}

function AddSpendingCard({ categories, onAddSpending, onNavigate }) {
  const spendingCategories = useMemo(() => buildAddSpendingCategories(categories), [categories]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    categoryId: spendingCategories[0]?.id || "",
    date: localDateString(),
    note: "",
    paymentMethod: "upi"
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm((current) => {
      const hasSelected = spendingCategories.some((category) => String(category.id) === String(current.categoryId));
      return { ...current, categoryId: hasSelected ? current.categoryId : spendingCategories[0]?.id || "" };
    });
  }, [spendingCategories]);

  async function submit(event) {
    event.preventDefault();
    if (!form.amount || !form.categoryId) return;
    setSaving(true);
    setSaved(false);
    try {
      await onAddSpending({
        ...form,
        amount: Number(form.amount),
        categoryId: Number(form.categoryId),
        note: form.note || "Dashboard spending"
      });
      setForm((current) => ({
        ...current,
        amount: "",
        note: "",
        date: localDateString()
      }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-normal">Add Spending</h2>
            <p className="mt-1 text-sm text-slate-400">Log a quick expense by category.</p>
          </div>
          <button
            className="btn-primary shrink-0 px-4 py-3"
            type="button"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={18} />
            Add spending
          </button>
        </div>

        {saved && <p className="mt-3 rounded-2xl bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200">Spending added. Charts are updated.</p>}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <form className="card w-full max-w-2xl p-5 md:p-6" onSubmit={submit}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Add Spending</h3>
                <p className="mt-1 text-sm text-slate-400">Add how much money you spent in a specific category.</p>
              </div>
              <button className="btn-soft px-3" type="button" onClick={() => setModalOpen(false)}>
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-300 sm:col-span-2">
                Amount spent
                <input
                  className="input mt-2"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="₹0.00"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  required
                />
              </label>
              <label className="block text-sm font-semibold text-slate-300">
                Category
                <select className="input mt-2" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required>
                  {spendingCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-300">
                Date
                <input className="input mt-2" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
              </label>
              <label className="block text-sm font-semibold text-slate-300">
                Payment
                <select className="input mt-2" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-300">
                Note
                <input
                  className="input mt-2"
                  maxLength={180}
                  placeholder="Lunch, metro, books..."
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button className="btn-soft" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-soft" type="button" onClick={() => onNavigate("/spending")}>View Spending</button>
              <button className="btn-primary" disabled={saving || spendingCategories.length === 0}>
                <Plus size={17} />
                {saving ? "Adding..." : "Add spending"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function buildAddSpendingCategories(categories = []) {
  const byName = new Map(categories.map((category) => [String(category.name).toLowerCase(), category]));
  return addSpendingCategoryNames.map((name) => {
    const existing = byName.get(name.toLowerCase());
    if (existing) return { ...existing, name };
    const fallback = addSpendingCategoryFallbacks[name];
    return { id: fallback.id, name, color: fallback.color };
  });
}

function BudgetSummaryCard({ income, summary, recurringTotal = 0, onNavigate }) {
  const rows = [
    { label: "Total budget", value: summary.monthlyBudget, icon: WalletCards, tone: "text-violet-200", bg: "bg-violet-500/15" },
    { label: "Spent this month", value: summary.monthlyTotal, icon: ReceiptText, tone: "text-amber-200", bg: "bg-amber-500/15" },
    { label: "Recurring amount", value: recurringTotal, icon: Repeat, tone: "text-sky-200", bg: "bg-sky-500/15" },
    { label: "Remaining money", value: summary.remainingBudget, icon: PiggyBank, tone: summary.remainingBudget >= 0 ? "text-emerald-300" : "text-rose-300", bg: summary.remainingBudget >= 0 ? "bg-emerald-500/15" : "bg-rose-500/15" }
  ];

  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold tracking-normal">Budget</h2>
      <div className="mt-4 divide-y divide-white/10">
        {rows.map(({ label, value, icon: Icon, tone, bg }) => (
          <div key={label} className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-2xl ${bg} ${tone}`}>
                <Icon size={18} />
              </span>
              <span className="text-sm font-semibold text-slate-300">{label}</span>
            </span>
            <span className={`text-sm font-black tabular-nums ${tone}`}>{formatCurrency(value)}</span>
          </div>
        ))}
      </div>
      <button className="btn-soft mt-4 w-full" onClick={() => onNavigate("/budget")}>See All Categories</button>
    </section>
  );
}

function SmartAdviceCard({ advice, summary, subscriptionTotal }) {
  const insights = [
    advice.highestCategory ? `${advice.highestCategory.category} is your highest spending category.` : "Add more expenses to unlock stronger insights.",
    summary.budgetStatus === "over" ? "You are over your monthly budget." : "You are within your monthly budget.",
    `Subscriptions make up ${formatCurrency(subscriptionTotal)} of planned spending.`
  ];

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <Bot className="text-violet-300" size={20} />
        <h2 className="text-lg font-bold tracking-normal">Smart Advice</h2>
      </div>
      <div className="mt-4 space-y-2">
        {insights.map((item) => (
          <p key={item} className="rounded-2xl bg-white/8 p-3 text-sm leading-6 text-slate-300">{item}</p>
        ))}
      </div>
    </section>
  );
}

function SpendingAnalyticsPage({ summary, expenses, lastMonthExpenses, subscriptions, calendarMonth, selectedDate, onMonthChange, onToday, onDateSelect, onRemoveCategorySpending }) {
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [activePieIndex, setActivePieIndex] = useState(null);
  const [activePieCategory, setActivePieCategory] = useState(null);
  const [pieAnimationDone, setPieAnimationDone] = useState(false);
  const onboarding = getOnboarding();
  const income = Number(onboarding?.monthlyIncome || 0);
  const billsTotal = subscriptions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const analysisRows = buildCategoryAnalysis(expenses, lastMonthExpenses, subscriptions);
  const highest = analysisRows[0];
  const breakdownTotal = analysisRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const activeBreakdown = activePieCategory || { category: "Total spent", amount: breakdownTotal };
  const frequent = buildFrequentSpend(expenses);
  const remaining = Math.max(0, summary.monthlyBudget - summary.monthlyTotal);
  const budgetDelta = summary.monthlyBudget - summary.monthlyTotal;

  useEffect(() => {
    setPieAnimationDone(false);
    setActivePieIndex(null);
    setActivePieCategory(null);
    const timer = window.setTimeout(() => setPieAnimationDone(true), 1500);
    return () => window.clearTimeout(timer);
  }, [breakdownTotal, analysisRows.length]);

  return (
    <div className="space-y-4">
      <SpendingCalendarPanel
        month={calendarMonth}
        expenses={expenses}
        selectedDate={selectedDate}
        expanded={calendarExpanded}
        onToggle={() => setCalendarExpanded((expanded) => !expanded)}
        onMonthChange={onMonthChange}
        onToday={onToday}
        onDateSelect={onDateSelect}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.8fr)]">
        <section className="space-y-4">
          <section className="card p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-normal">Spending Breakdown</h2>
            </div>
            <div className="mt-4 flex justify-center">
              {analysisRows.length === 0 ? (
                <div className="grid min-h-72 w-full place-items-center rounded-[24px] border border-dashed border-violet-300/20 bg-white/[0.03] p-8 text-center">
                  <p className="max-w-sm text-sm font-semibold leading-6 text-slate-400">Add expenses to see your spending breakdown.</p>
                </div>
              ) : (
                <div className="relative h-[26rem] w-full max-w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.15),transparent_62%)]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <filter id="spendingDonutGlow" x="-35%" y="-35%" width="170%" height="170%">
                          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#8b5cf6" floodOpacity="0.46" />
                        </filter>
                      </defs>
                      <Pie
                        key={`spending-donut-${breakdownTotal}-${analysisRows.length}`}
                        data={analysisRows}
                        dataKey="amount"
                        nameKey="category"
                        innerRadius={118}
                        outerRadius={178}
                        paddingAngle={2}
                        activeIndex={pieAnimationDone && activePieIndex !== null ? activePieIndex : undefined}
                        activeShape={renderActiveSpendingSlice}
                        onMouseEnter={(row, index) => {
                          if (!pieAnimationDone) return;
                          setActivePieIndex(index);
                          setActivePieCategory(row);
                        }}
                        onMouseLeave={() => {
                          if (!pieAnimationDone) return;
                          setActivePieIndex(null);
                          setActivePieCategory(null);
                        }}
                        onClick={(row, index) => {
                          if (!pieAnimationDone) return;
                          setActivePieIndex(index);
                          setActivePieCategory(row);
                        }}
                        isAnimationActive
                        animationBegin={120}
                        animationDuration={1300}
                        animationEasing="ease-out"
                      >
                        {analysisRows.map((row, index) => (
                          <Cell
                            key={row.category}
                            fill={getCategoryMeta(row.category).color || categoryShade(index)}
                            opacity={activePieIndex === null || activePieIndex === index ? 1 : 0.42}
                            stroke="rgba(255,255,255,0.82)"
                            strokeWidth={1.5}
                            style={{ cursor: "pointer", transition: "opacity 0.25s ease, filter 0.25s ease" }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {!pieAnimationDone && <div className="absolute inset-0 z-10" aria-hidden="true" />}
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">{activeBreakdown.category}</p>
                      <p className="mt-1 text-2xl font-black text-white">{formatCurrency(activeBreakdown.amount || 0)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <CategoryBreakdownTable rows={analysisRows} onRemoveCategorySpending={onRemoveCategorySpending} />
        </section>

        <aside className="space-y-4">
          <SummaryAnalyticsCard income={income} bills={billsTotal} spending={summary.monthlyTotal} remaining={remaining} />
          <FrequentSpendCard rows={frequent} />
          <section className="card p-4">
            <div className="flex items-center gap-2">
              <Bot className="text-violet-300" size={16} />
              <h2 className="text-base font-bold tracking-normal">Budget Insight</h2>
            </div>
            <div className="mt-3 space-y-2">
              <p className="rounded-xl bg-white/7 px-3 py-2 text-xs leading-5 text-slate-300">
                {budgetDelta >= 0 ? `You are ${formatCurrency(budgetDelta)} under your monthly budget.` : `You are ${formatCurrency(Math.abs(budgetDelta))} over your monthly budget.`}
              </p>
              <p className="rounded-xl bg-white/7 px-3 py-2 text-xs leading-5 text-slate-300">
                {highest ? `${highest.category} is ${highest.percent.toFixed(1)}% of your total spending.` : "Add expenses to see category insights."}
              </p>
              <p className="rounded-xl bg-white/7 px-3 py-2 text-xs leading-5 text-slate-300">
                {analysisRows.find((row) => row.category === "Subscriptions")?.change > 0 ? "Subscriptions increased compared to last month." : "Subscriptions are stable compared to last month."}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SpendingCalendarPanel({ month, expenses, selectedDate, expanded, onToggle, onMonthChange, onToday, onDateSelect }) {
  const days = buildCalendarDays(month);
  const today = localDateString();
  const byDate = useMemo(() => {
    return expenses.reduce((acc, expense) => {
      if (!acc[expense.date]) acc[expense.date] = { total: 0, expenses: [] };
      acc[expense.date].total += Number(expense.amount || 0);
      acc[expense.date].expenses.push(expense);
      return acc;
    }, {});
  }, [expenses]);
  const monthTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const selected = byDate[selectedDate] || { total: 0, expenses: [] };
  const activeDates = Object.keys(byDate).filter((date) => byDate[date].total > 0).length;

  if (!expanded) {
    return (
      <section className="card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-violet-300">Calendar view</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <h2 className="text-xl font-black text-white">{formatMonthLabel(month)}</h2>
              <p className="text-sm font-semibold text-slate-400">{formatCurrency(monthTotal)} spent this month</p>
              <p className="text-sm text-slate-500">{activeDates} active day{activeDates === 1 ? "" : "s"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-soft px-3" onClick={() => onMonthChange(-1)} aria-label="Previous month"><ArrowLeft size={16} /></button>
            <button className="btn-soft" onClick={onToday}>Today</button>
            <button className="btn-soft px-3" onClick={() => onMonthChange(1)} aria-label="Next month"><ArrowRight size={16} /></button>
            <button className="btn-primary" onClick={onToggle}>Expand</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-violet-300">Calendar view</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal text-white">{formatMonthLabel(month)}</h2>
          <p className="mt-1 text-sm text-slate-400">{formatCurrency(monthTotal)} spent this month</p>
        </div>
          <div className="flex flex-wrap items-center gap-2">
          <button className="btn-soft animate-calendarControlIn px-3 [animation-delay:120ms]" onClick={() => onMonthChange(-1)} aria-label="Previous month"><ArrowLeft size={16} /></button>
          <button className="btn-soft animate-calendarControlIn [animation-delay:190ms]" onClick={onToday}>Today</button>
          <button className="btn-soft animate-calendarControlIn px-3 [animation-delay:260ms]" onClick={() => onMonthChange(1)} aria-label="Next month"><ArrowRight size={16} /></button>
          <button className="btn-primary animate-calendarControlIn [animation-delay:330ms]" onClick={onToggle}>Minimize</button>
        </div>
      </div>

      <div className="grid origin-top animate-calendarSlideDown lg:grid-cols-[1fr_18rem] xl:grid-cols-[1fr_20rem]">
        <div className="p-3 md:p-4">
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs font-bold text-slate-400">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              if (day.empty) return <div key={day.key} className="min-h-16 rounded-2xl bg-slate-900/35 md:min-h-20" />;
              const bucket = byDate[day.date];
              const isSelected = day.date === selectedDate;
              const isToday = day.date === today;
              const total = bucket?.total || 0;

              return (
                <button
                  key={day.key}
                  className={`min-h-16 rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 md:min-h-20 ${
                    isSelected
                      ? "border-violet-300 bg-violet-500 text-white shadow-[0_18px_45px_rgba(139,92,246,0.22)]"
                      : isToday
                        ? "border-violet-300/70 bg-violet-500/10 text-slate-100"
                        : "border-white/10 bg-slate-900/70 text-slate-200 hover:border-violet-300/60"
                  }`}
                  onClick={() => onDateSelect(day.date)}
                >
                  <span className={`text-xs font-black ${isSelected ? "text-white" : "text-slate-400"}`}>{day.day}</span>
                  <span className={`mt-3 block text-xs font-bold tabular-nums ${isSelected ? "text-white" : total > 0 ? "text-slate-100" : "text-slate-500"}`}>
                    {formatCurrency(total)}
                  </span>
                  {bucket?.expenses?.length > 0 && (
                    <span className="mt-2 flex gap-1">
                      {bucket.expenses.slice(0, 4).map((expense, index) => (
                        <span
                          key={`${expense.id}-${index}`}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: isSelected ? "#ffffff" : getCategoryMeta(expense.category).color || expense.categoryColor || categoryShade(index) }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="border-t border-white/10 bg-slate-950/45 p-4 lg:border-l lg:border-t-0">
          <p className="text-sm font-semibold text-slate-400">Selected day</p>
          <h3 className="mt-1 text-xl font-black tracking-normal text-white">{selectedDate}</h3>
          <p className="mt-2 text-3xl font-black tabular-nums text-white">{formatCurrency(selected.total)}</p>
          <div className="mt-5 space-y-2">
            {selected.expenses.length === 0 ? (
              <p className="rounded-2xl bg-white/8 p-3 text-sm leading-5 text-slate-400">No spending recorded for this day.</p>
            ) : selected.expenses.map((expense, index) => (
              <div key={expense.id || `${expense.note}-${index}`} className="rounded-2xl bg-white/8 p-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: getCategoryMeta(expense.category).color || expense.categoryColor || categoryShade(index) }} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-100">{expense.note || expense.category || "Spending"}</span>
                      <span className="text-xs text-slate-400">{expense.category || "Other"} - {expense.paymentMethod || "payment"}</span>
                      {expense.eventName && <span className="mt-1 block text-[0.65rem] font-bold text-violet-200">Event: {expense.eventName}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-black tabular-nums text-white">{formatCurrency(expense.amount || 0)}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function CategoryBreakdownTable({ rows, onRemoveCategorySpending }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-white/10 p-5">
        <h2 className="text-lg font-bold tracking-normal">Category Breakdown</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">% Spend</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row, index) => (
              <tr key={row.category} className="group transition hover:bg-white/5">
                <td className="px-5 py-4">
                  <span className="flex items-center gap-3 font-semibold text-slate-100">
                    <CategoryBadge category={row.category} size={36} iconSize={16} />
                    {row.category}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-300">{row.percent.toFixed(1)}% of spend</td>
                <td className="px-5 py-4 font-bold tabular-nums text-slate-100">{formatCurrency(row.amount)}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`font-bold ${row.change <= 0 ? "text-emerald-300" : "text-amber-300"}`}>
                      {row.change === 0 ? "No change" : `${row.change > 0 ? "+" : "-"}${formatCurrency(Math.abs(row.change))}`}
                    </span>
                    <button
                      className="grid h-8 w-8 place-items-center rounded-full bg-rose-500/15 text-rose-200 opacity-0 transition hover:bg-rose-500/25 group-hover:opacity-100 focus:opacity-100"
                      type="button"
                      aria-label={`Remove ${row.category} spending`}
                      onClick={() => onRemoveCategorySpending?.(row.category)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportsPage({ summary, expenses, events, advice }) {
  const [eventFilter, setEventFilter] = useState("all");
  const rows = useMemo(() => {
    if (eventFilter === "all") return expenses;
    if (eventFilter === "event-only") return expenses.filter((expense) => expense.eventId);
    return expenses.filter((expense) => String(expense.eventId) === String(eventFilter));
  }, [eventFilter, expenses]);
  const reportSummary = useMemo(() => buildReportSummary(rows, summary), [rows, summary]);
  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Reports</h2>
            <p className="mt-1 text-sm text-slate-400">Filter analytics by all spending, event spending, or a specific event.</p>
          </div>
          <select className="input md:w-72" value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
            <option value="all">All spending</option>
            <option value="event-only">Event spending only</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select>
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <TrendChart data={reportSummary.trend} />
        <CategoryChart data={reportSummary.categories} />
        <div className="xl:col-span-2">
          <AdvicePanel advice={advice} />
        </div>
      </div>
    </div>
  );
}

function buildReportSummary(expenses, fallbackSummary) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const categories = Object.values(expenses.reduce((acc, expense) => {
    const name = expense.category || "Other";
    if (!acc[name]) acc[name] = { name, total: 0, color: getCategoryMeta(name).color };
    acc[name].total += Number(expense.amount || 0);
    return acc;
  }, {})).map((row) => ({ ...row, percent: total ? Math.round((row.total / total) * 10000) / 100 : 0 })).sort((a, b) => b.total - a.total);
  const trend = Object.values(expenses.reduce((acc, expense) => {
    if (!acc[expense.date]) acc[expense.date] = { date: expense.date, total: 0 };
    acc[expense.date].total += Number(expense.amount || 0);
    return acc;
  }, {})).sort((a, b) => a.date.localeCompare(b.date));
  return { ...fallbackSummary, categories, trend, monthlyTotal: total };
}

function renderActiveSpendingSlice(props) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload
  } = props;
  return (
    <g style={{ transition: "all 0.25s ease", cursor: "pointer" }}>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 11}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        filter="url(#spendingDonutGlow)"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth={2}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 11}
        outerRadius={outerRadius + 14}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={payload?.depthColor || "rgba(15,23,42,0.55)"}
        opacity={0.7}
      />
    </g>
  );
}

function SpendingDonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-2xl border border-violet-300/20 bg-slate-950/95 px-4 py-3 text-sm shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur">
      <p className="font-black text-white">{row.category}</p>
      <p className="mt-1 text-lg font-black tabular-nums text-violet-100">{formatCurrency(row.amount || 0)}</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">{Number(row.percent || 0).toFixed(1)}% of total spending</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">{row.count || 0} transaction{Number(row.count || 0) === 1 ? "" : "s"}</p>
    </div>
  );
}

function SummaryAnalyticsCard({ bills, spending, remaining }) {
  const rows = [
    { icon: CalendarClock, label: "Bills", helper: "Recurring charges", amount: bills, tone: "text-slate-100" },
    { icon: ReceiptText, label: "Spending", helper: "This month expenses", amount: spending, tone: "text-slate-100" },
    { icon: PiggyBank, label: "Remaining", helper: "Budget left", amount: remaining, tone: "text-violet-200" }
  ];

  return (
    <section className="card p-4">
      <h2 className="text-base font-bold tracking-normal">Summary</h2>
      <div className="mt-3 divide-y divide-white/10">
        {rows.map(({ icon: Icon, label, helper, amount, tone }) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/8 text-violet-200"><Icon size={15} /></span>
              <span>
                <span className="block text-xs font-bold text-slate-100">{label}</span>
                <span className="text-[11px] text-slate-500">{helper}</span>
              </span>
            </span>
            <span className={`text-xs font-black tabular-nums ${tone}`}>{formatCurrency(amount)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FrequentSpendCard({ rows }) {
  return (
    <section className="card p-4">
      <h2 className="text-base font-bold tracking-normal">Frequent Spend</h2>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-xl bg-white/7 px-3 py-2 text-xs text-slate-400">No frequent spend patterns yet.</p>
        ) : rows.map((row) => (
          <div key={row.label} className="rounded-xl bg-white/7 px-3 py-2">
            <p className="text-xs font-semibold leading-5 text-slate-200">{row.label} · {row.count} time{row.count === 1 ? "" : "s"}</p>
            <p className="mt-0.5 text-xs font-bold text-violet-200">{formatCurrency(row.amount)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function isSubscriptionDueToday(item) {
  if (!item || item.active === false) return false;
  const today = localDateString();
  if (item.nextDueDate === today || item.dueDate === today) return true;
  const todayDay = Number(today.slice(-2));
  return Number(item.billingDay || 0) === todayDay;
}

function DashboardSidebar({ user, subscriptions = [], onLogout, onNavigate, activePath }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [navItems, setNavItems] = useState(readSidebarItems);
  const dueToday = useMemo(() => subscriptions.filter(isSubscriptionDueToday), [subscriptions]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    function handleReset() {
      setNavItems(defaultSidebarItems);
    }
    window.addEventListener("spendly-sidebar-reset", handleReset);
    return () => window.removeEventListener("spendly-sidebar-reset", handleReset);
  }, []);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setNavItems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const next = arrayMove(items, oldIndex, newIndex);
      saveSidebarItems(next);
      return next;
    });
  }

  return (
    <>
    <aside className="card card-static z-50 hidden h-[calc(100vh-3rem)] min-h-[38rem] flex-col rounded-l-none border-l-0 p-5 lg:sticky lg:top-6 lg:flex" style={{ overflow: "visible" }}>
      <div className="mb-7">
        <SpendlyLogo size="sm" />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white">Hi, {user?.name?.split(" ")[0] || "Student"}</p>
          <p className="mt-1 text-xs font-medium text-violet-300">Premium Member</p>
        </div>
        <div className="relative flex gap-2">
          <button
            className="relative grid h-9 w-9 place-items-center rounded-2xl bg-white/8 text-slate-300 transition hover:bg-violet-500/20 hover:text-violet-100"
            aria-label={`${dueToday.length} subscription notifications`}
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setSettingsOpen(false);
            }}
          >
            <Bell size={17} />
            {dueToday.length > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-violet-500 px-1 text-[0.65rem] font-black text-white ring-2 ring-slate-950">
                {dueToday.length}
              </span>
            )}
          </button>
          <button
            className="grid h-9 w-9 place-items-center rounded-2xl bg-white/8 text-slate-300 transition hover:bg-violet-500/20 hover:text-violet-100"
            aria-label="Settings"
            aria-expanded={settingsOpen}
            onClick={() => {
              setSettingsOpen((open) => !open);
              setNotificationsOpen(false);
            }}
          >
            <Settings size={17} />
          </button>
          {notificationsOpen && (
            <div className="absolute left-0 top-11 z-[9999] w-72 rounded-3xl border border-white/10 bg-slate-950/95 p-3 shadow-soft backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">Notifications</p>
                  <p className="mt-1 text-xs text-slate-400">Recurring payments due today</p>
                </div>
                {dueToday.length > 0 && <span className="rounded-full bg-violet-500/20 px-2 py-1 text-xs font-black text-violet-100">{dueToday.length}</span>}
              </div>
              <div className="mt-3 space-y-2">
                {dueToday.length === 0 ? (
                  <p className="rounded-2xl bg-white/8 p-3 text-sm leading-5 text-slate-400">No subscription payments are due today.</p>
                ) : dueToday.map((item) => (
                  <div key={item.id || item.name} className="rounded-2xl border border-violet-400/15 bg-violet-500/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-bold text-slate-100">{item.name}</p>
                      <p className="shrink-0 text-sm font-black text-violet-100">{formatCurrency(item.amount || 0)}</p>
                    </div>
                    <p className="mt-1 text-xs capitalize text-slate-400">{item.paymentMethod || "payment"} payment due today</p>
                  </div>
                ))}
              </div>
              <button
                className="btn-soft mt-3 w-full justify-center"
                type="button"
                onClick={() => {
                  setNotificationsOpen(false);
                  onNavigate("/subscriptions");
                }}
              >
                View recurring
              </button>
            </div>
          )}
          {settingsOpen && (
            <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-soft backdrop-blur">
              <button
                className="w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold text-slate-200 transition hover:bg-violet-500/15 hover:text-violet-100"
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onNavigate("/preferences");
                }}
              >
                Preferences
              </button>
              <button
                className="mt-1 w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15"
                type="button"
                onClick={onLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={navItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <nav className="mt-8 space-y-2" aria-label="Draggable sidebar navigation">
            {navItems.map((item) => (
              <SortableSidebarItem
                key={item.id}
                item={item}
                active={activePath === item.path || (item.path === "/settings" && activePath === "/preferences")}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        </SortableContext>
      </DndContext>

      <div className="mt-auto rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.28),transparent_12rem),rgba(15,23,42,0.72)] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-200 shadow-[0_0_24px_rgba(139,92,246,0.24)]">
          <Crown size={22} />
        </span>
        <p className="mt-4 text-lg font-black text-white">Premium</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">Unlock exclusive insights and smarter financial tracking.</p>
        <button className="btn-primary mt-5 w-full justify-center py-3" type="button" onClick={() => setPremiumOpen(true)}>
          Go Premium
          <ArrowRight size={17} />
        </button>
      </div>
    </aside>
    {premiumOpen && <PremiumPlansModal onClose={() => setPremiumOpen(false)} />}
    </>
  );
}

function PremiumPlansModal({ onClose }) {
  const plans = [
    {
      name: "Student",
      price: "₹99",
      cadence: "/month",
      description: "Simple upgrades for day-to-day student budgeting.",
      features: ["Advanced budget alerts", "Recurring payment reminders", "CSV exports"]
    },
    {
      name: "Premium",
      price: "₹199",
      cadence: "/month",
      description: "Smarter insights for active Spendly users.",
      features: ["AI spending insights", "Category trend forecasts", "Priority dashboard widgets"],
      featured: true
    },
    {
      name: "Pro",
      price: "₹499",
      cadence: "/month",
      description: "Power tools for shared and detailed finance tracking.",
      features: ["Multi-profile tracking", "Receipt intelligence", "Custom analytics reports"]
    }
  ];

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm">
      <section className="card w-full max-w-5xl p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-violet-300">Spendly Premium</p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Choose your plan</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Upgrade when you want deeper insights, better reminders, and more control over your budget.</p>
          </div>
          <button className="btn-soft px-3" type="button" onClick={onClose} aria-label="Close premium plans">
            <X size={18} />
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-[24px] border p-5 transition hover:-translate-y-0.5 ${
                plan.featured
                  ? "border-violet-300/45 bg-violet-500/15 shadow-[0_22px_55px_rgba(139,92,246,0.18)]"
                  : "border-white/10 bg-white/7"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-black text-white">{plan.name}</h3>
                {plan.featured && <span className="rounded-full bg-violet-500 px-3 py-1 text-xs font-black text-white">Popular</span>}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{plan.description}</p>
              <p className="mt-5 text-4xl font-black text-white">
                {plan.price}
                <span className="text-sm font-semibold text-slate-500">{plan.cadence}</span>
              </p>
              <div className="mt-5 space-y-3">
                {plan.features.map((feature) => (
                  <p key={feature} className="flex items-center gap-3 text-sm font-semibold text-slate-200">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
                      <Check size={14} />
                    </span>
                    {feature}
                  </p>
                ))}
              </div>
              <button className={plan.featured ? "btn-primary mt-6 w-full justify-center" : "btn-soft mt-6 w-full justify-center"} type="button">
                Select {plan.name}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function SortableSidebarItem({ item, active, onNavigate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const Icon = item.icon;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      className={`sidebar-link group flex w-full cursor-grab touch-none items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition active:cursor-grabbing ${
        active
          ? "bg-violet-500/15 text-violet-200 shadow-[inset_3px_0_0_rgba(167,139,250,0.9)]"
          : "text-slate-400 hover:bg-white/8 hover:text-slate-100"
      } ${isDragging ? "border border-violet-300/35 bg-violet-500/20 shadow-[0_18px_45px_rgba(139,92,246,0.22)]" : ""}`}
      type="button"
      onClick={() => {
        if (!isDragging) onNavigate(item.path);
      }}
      aria-label={`Open ${item.label}. Drag to reorder.`}
      {...attributes}
      {...listeners}
    >
      <Icon className={active ? "text-violet-200" : "text-slate-500 group-hover:text-violet-200"} size={18} />
      <span className="min-w-0 flex-1">{item.label}</span>
      <span className="text-slate-600 opacity-0 transition group-hover:opacity-100" aria-hidden="true">::</span>
    </button>
  );
}

function PreferencesPage({ user, onBack, onLogout, onRedoOnboarding }) {
  const onboarding = getOnboarding();
  const [redoing, setRedoing] = useState(false);
  const [redoError, setRedoError] = useState("");

  async function handleRedoOnboarding() {
    const confirmed = await confirmSpendly({
      title: "Redo onboarding?",
      message: "This will reopen the setup wizard so you can update your budget, categories, and preferences.",
      confirmLabel: "Redo setup"
    });
    if (!confirmed) return;
    setRedoing(true);
    setRedoError("");
    try {
      await onRedoOnboarding();
    } catch (err) {
      setRedoing(false);
      setRedoError(err.message || "Could not restart onboarding.");
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.24),transparent_32rem),linear-gradient(180deg,#070816_0%,#111827_52%,#070816_100%)] px-4 py-6 text-slate-100 md:px-6">
      <section className="mx-auto max-w-3xl">
        <button className="btn-soft mb-4 px-3" onClick={onBack}>
          <ArrowLeft size={16} />
          Dashboard
        </button>
        <div className="card p-5 md:p-6">
          <p className="text-sm font-semibold text-violet-300">Preferences</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal">Account settings</h1>
          <p className="mt-2 text-sm text-slate-400">Manage your local profile and setup preferences.</p>

          <div className="mt-6 grid gap-3">
            <div className="rounded-3xl border border-white/10 bg-white/8 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Profile</p>
              <p className="mt-2 text-lg font-bold">{user?.name || "Student"}</p>
              <p className="text-sm text-slate-400">{user?.email || "No email saved"}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/8 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Onboarding</p>
              <p className="mt-2 text-sm text-slate-300">Monthly budget: Rs {onboarding?.monthlyBudget || 0}</p>
              <p className="mt-1 text-sm text-slate-300">Savings goal: {onboarding?.goalName || "Not set"}</p>
              <p className="mt-1 text-sm text-slate-300">Categories: {(onboarding?.categories || []).join(", ") || "Not set"}</p>
              <p className="mt-3 text-sm text-slate-400">Redo setup to update your profile, budget limits, savings goal, categories, and optional recurring payments.</p>
              {redoError && <p className="mt-3 rounded-2xl bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200">{redoError}</p>}
              <button className="btn-primary mt-4" type="button" onClick={handleRedoOnboarding} disabled={redoing}>
                {redoing ? "Opening onboarding..." : "Redo onboarding"}
              </button>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/8 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Navigation</p>
              <p className="mt-2 text-sm text-slate-400">Restore the sidebar menu to the original Spendly order.</p>
              <button className="btn-soft mt-4" onClick={resetSidebarOrder}>Reset sidebar order</button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button className="btn-primary" onClick={onBack}>Back to dashboard</button>
            <button className="btn-danger" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </section>
      <SpendlyConfirmHost />
    </main>
  );
}

function applyOnboardingBudget(baseSummary, monthlyBudget) {
  const remainingBudget = Math.max(0, monthlyBudget - baseSummary.monthlyTotal);
  const budgetUsedPercent = monthlyBudget ? Math.round((baseSummary.monthlyTotal / monthlyBudget) * 10000) / 100 : 0;
  const budgetStatus = baseSummary.monthlyTotal > monthlyBudget ? "over" : baseSummary.monthlyTotal > monthlyBudget * 0.85 ? "near" : "ok";
  return {
    ...baseSummary,
    monthlyBudget,
    remainingBudget,
    budgetUsedPercent,
    safeToSpendPerDay: Number((remainingBudget / Math.max(1, baseSummary.daysRemaining)).toFixed(2)),
    budgetStatus
  };
}

function buildBudgetSyncedSummary(summary, recurringTotal = 0) {
  const monthlyBudget = readBudgetPageMonthlyTotal(summary.monthlyBudget);
  const monthlyTotal = Number(summary.monthlyTotal || 0);
  const plannedRecurring = Number(recurringTotal || 0);
  const remainingBudget = monthlyBudget - monthlyTotal - plannedRecurring;
  const budgetUsedPercent = monthlyBudget ? Math.round(((monthlyTotal + plannedRecurring) / monthlyBudget) * 10000) / 100 : 0;
  const budgetStatus = monthlyBudget && remainingBudget < 0 ? "over" : monthlyBudget && budgetUsedPercent > 85 ? "near" : "ok";
  return {
    ...summary,
    monthlyBudget,
    remainingBudget,
    budgetUsedPercent,
    safeToSpendPerDay: Number((remainingBudget / Math.max(1, Number(summary.daysRemaining || 1))).toFixed(2)),
    budgetStatus
  };
}

function readBudgetPageMonthlyTotal(fallback = 0) {
  try {
    const stored = JSON.parse(localStorage.getItem(BUDGET_CATEGORIES_KEY) || "{}");
    const localCategories = JSON.parse(localStorage.getItem(SPENDLY_CATEGORIES_KEY) || "[]");
    const hiddenRows = new Set(JSON.parse(localStorage.getItem(HIDDEN_BUDGET_ROWS_KEY) || "[]"));
    const categoryNames = new Set(addSpendingCategoryNames.filter((name) => !hiddenRows.has(name)));
    if (Array.isArray(localCategories)) {
      localCategories.forEach((item) => {
        if (item?.name && !hiddenRows.has(item.name)) categoryNames.add(item.name);
      });
    }
    const categoryTotal = [...categoryNames].reduce((sum, name) => sum + Number(stored[name] || 0), 0);
    return categoryTotal;
  } catch {
    return Number(fallback || 0);
  }
}

function MobileNav({ activePath, onNavigate }) {
  const [items, setItems] = useState(readSidebarItems);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    function handleReset() {
      setItems(defaultSidebarItems);
    }
    window.addEventListener("spendly-sidebar-reset", handleReset);
    return () => window.removeEventListener("spendly-sidebar-reset", handleReset);
  }, []);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);
      const next = arrayMove(current, oldIndex, newIndex);
      saveSidebarItems(next);
      return next;
    });
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 px-3 py-2 backdrop-blur lg:hidden">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-1 overflow-x-auto pb-1" aria-label="Draggable mobile navigation">
            {items.map((item) => (
              <SortableMobileNavItem key={item.id} item={item} active={activePath === item.path} onNavigate={onNavigate} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </nav>
  );
}

function SortableMobileNavItem({ item, active, onNavigate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const Icon = item.icon;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      className={`min-w-24 cursor-grab touch-none rounded-2xl px-2 py-2 text-xs font-semibold active:cursor-grabbing ${
        active ? "bg-violet-500/20 text-violet-100" : "text-slate-400"
      } ${isDragging ? "scale-105 border border-violet-300/35 shadow-[0_12px_32px_rgba(139,92,246,0.22)]" : ""}`}
      onClick={() => onNavigate(item.path)}
      aria-label={`Open ${item.label}. Drag to reorder.`}
      {...attributes}
      {...listeners}
    >
      <Icon className="mx-auto mb-1" size={16} />
      {item.label}
    </button>
  );
}

function pageTitle(path, month) {
  const titles = {
    "/dashboard": `${formatMonthLabel(month)} overview`,
    "/spending": "Spending",
    "/reports/spending": "Spending",
    "/events": "Events",
    "/budget": "Budget",
    "/savings": "Savings",
    "/subscriptions": "Recurring",
    "/reports": "Reports"
  };
  return titles[path] || "Dashboard";
}

function pageDescription(path) {
  const descriptions = {
    "/spending": "Review monthly spending, category breakdowns, calendar activity, and budget insights.",
    "/reports/spending": "Review monthly spending, category breakdowns, calendar activity, and budget insights.",
    "/events": "Plan temporary budgets for trips, festivals, vacations, and other short-term goals.",
    "/budget": "Set category budgets, track actual spending, and see how much money remains.",
    "/subscriptions": "Track recurring bills, memberships, due dates, and automatic payments.",
    "/reports": "Explore spending reports and filter insights across your budget data."
  };
  return descriptions[path] || "";
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function firstName(name = "Student") {
  return String(name).trim().split(/\s+/)[0] || "Student";
}

function buildSpendChartData(thisMonthRows, lastMonthRows) {
  const byDay = (rows) =>
    rows.reduce((acc, item) => {
      const day = Number(String(item.date).slice(-2));
      acc[day] = (acc[day] || 0) + Number(item.amount || 0);
      return acc;
    }, {});
  const current = byDay(thisMonthRows);
  const previous = byDay(lastMonthRows);
  let currentRunning = 0;
  let previousRunning = 0;
  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    currentRunning += current[day] || 0;
    previousRunning += previous[day] || 0;
    return { day: String(day), thisMonth: currentRunning, lastMonth: previousRunning };
  });
}

function buildSixMonthBars(currentSpending, budget) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const isCurrent = index === 5;
    const baseline = Math.max(1200, Number(currentSpending || 0));
    return {
      month: date.toLocaleDateString("en-IN", { month: "short" }),
      spending: isCurrent ? Number(currentSpending || 0) : Math.round(baseline * (0.58 + index * 0.08)),
      budget: Number(budget || baseline * 1.25)
    };
  });
}

function buildCategoryAnalysis(expenses, lastMonthExpenses, subscriptions = []) {
  const totals = groupByCategory(expenses);
  const previous = groupByCategory(lastMonthExpenses);
  const counts = countByCategory(expenses);
  subscriptions.forEach((item) => {
    totals.Subscriptions = (totals.Subscriptions || 0) + Number(item.amount || 0);
    counts.Subscriptions = (counts.Subscriptions || 0) + 1;
  });
  const total = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  return Object.entries(totals)
    .map(([category, amount], index) => {
      const color = getCategoryMeta(category).color || categoryShade(index);
      return {
        category,
        amount,
        percent: total ? (amount / total) * 100 : 0,
        change: amount - (previous[category] || 0),
        count: counts[category] || 0,
        depthColor: shadeHexColor(color, -28)
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

function groupByCategory(rows) {
  return rows.reduce((acc, item) => {
    const category = item.category || "Other";
    acc[category] = (acc[category] || 0) + Number(item.amount || 0);
    return acc;
  }, {});
}

function countByCategory(rows) {
  return rows.reduce((acc, item) => {
    const category = item.category || "Other";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
}

function buildFrequentSpend(expenses) {
  const counts = expenses.reduce((acc, item) => {
    const label = item.category || "Other";
    if (!acc[label]) acc[label] = { label, count: 0, amount: 0 };
    acc[label].count += 1;
    acc[label].amount += Number(item.amount || 0);
    return acc;
  }, {});
  return Object.values(counts).sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, 3);
}

function categoryShade(index) {
  const colors = ["#8b5cf6", "#a78bfa", "#6366f1", "#c084fc", "#7c3aed", "#22c55e", "#38bdf8", "#f59e0b", "#f472b6", "#94a3b8"];
  return colors[index % colors.length];
}

function shadeHexColor(hex, amount) {
  const clean = String(hex || "#64748b").replace("#", "");
  if (clean.length !== 6) return "#334155";
  const channel = (index) => Math.max(0, Math.min(255, parseInt(clean.slice(index, index + 2), 16) + amount)).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

function formatReadableDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

function nextSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      iso: date.toISOString().slice(0, 10),
      dayNumber: date.getDate(),
      label: index === 0 ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short" })
    };
  });
}
