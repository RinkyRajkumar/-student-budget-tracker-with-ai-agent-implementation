import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, BarChart3, Bell, Bot, CalendarClock, CreditCard, Grid2X2, Landmark, PiggyBank, Plus, ReceiptText, Repeat, Settings, TrendingUp, WalletCards, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdvicePanel from "./components/AdvicePanel.jsx";
import { LoginPage, SignupPage } from "./components/AuthPages.jsx";
import BudgetPage from "./components/BudgetPage.jsx";
import BudgetPanel from "./components/BudgetPanel.jsx";
import { CategoryChart, TrendChart } from "./components/Charts.jsx";
import LandingPage from "./components/LandingPage.jsx";
import OnboardingPage from "./components/OnboardingPage.jsx";
import StatCard from "./components/StatCard.jsx";
import SubscriptionManagerPage from "./components/SubscriptionManagerPage.jsx";
import SpendlyLogo from "./components/SpendlyLogo.jsx";
import { api, readUser, saveSession } from "./services/api.js";
import { formatCurrency } from "./services/currency.js";
import { addMonths, buildCalendarDays, formatMonthLabel, localDateString, localMonthString, monthBounds } from "./services/dates.js";
import { mergeSpendlyCategories } from "./services/categories.js";
import { getOnboarding, getSessionUser, isOnboardingComplete, logoutUser } from "./services/localAuth.js";

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

const defaultSidebarItems = [
  { id: "dashboard", label: "Dashboard", icon: Grid2X2, path: "/dashboard" },
  { id: "spending", label: "Spending", icon: WalletCards, path: "/spending" },
  { id: "budget", label: "Budget", icon: PiggyBank, path: "/budget" },
  { id: "subscriptions", label: "Recurring", icon: Repeat, path: "/subscriptions" },
  { id: "reports", label: "Reports", icon: BarChart3, path: "/reports" }
];

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

  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  function go(nextPath) {
    navigateTo(nextPath);
  }

  function finishAuth(nextUser, target = "/dashboard") {
    setAppUser(nextUser);
    setOnboarded(isOnboardingComplete());
    go(target);
  }

  function completeOnboarding() {
    setOnboarded(true);
    go("/dashboard");
  }

  function logout() {
    logoutUser();
    setAppUser(null);
    setOnboarded(false);
    go("/");
  }

  if (path === "/login") {
    if (appUser && onboarded) {
      go("/dashboard");
      return null;
    }
    return <LoginPage onNavigate={go} onLogin={(nextUser) => finishAuth(nextUser, isOnboardingComplete() ? "/dashboard" : "/onboarding")} />;
  }

  if (path === "/signup") {
    if (appUser && onboarded) {
      go("/dashboard");
      return null;
    }
    return <SignupPage onNavigate={go} onSignup={(nextUser) => finishAuth(nextUser, "/onboarding")} />;
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

  const protectedPages = ["/spending", "/reports/spending", "/budget", "/savings", "/subscriptions", "/reports", "/settings", "/preferences"];
  if (protectedPages.includes(path)) {
    if (!appUser) {
      go("/login");
      return null;
    }
    if (!onboarded) {
      go("/onboarding");
      return null;
    }
    if (path === "/settings" || path === "/preferences") return <PreferencesPage user={appUser} onBack={() => go("/dashboard")} onLogout={logout} />;
    return <Dashboard appUser={appUser} onLogout={logout} onNavigate={go} activePath={path} />;
  }

  return <LandingPage onNavigate={go} />;
}

function Dashboard({ appUser, onLogout, onNavigate, activePath = "/dashboard" }) {
  const [user, setUser] = useState(readUser());
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [calendarExpenses, setCalendarExpenses] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [lastMonthExpenses, setLastMonthExpenses] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [advice, setAdvice] = useState(emptyAdvice);
  const [budget, setBudget] = useState({ monthlyLimit: 0 });
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
      const [categoryRes, expenseRes, summaryRes, adviceRes, budgetRes, goalRes, subscriptionRes, calendarExpenseRes, lastMonthExpenseRes] = await Promise.all([
        api.get("/categories"),
        api.get("/expenses", { params: queryFilters }),
        api.get("/summary", { params: { month: calendarMonth } }),
        api.get("/advice", { params: { month: calendarMonth } }),
        api.get("/budget"),
        api.get("/savings-goal"),
        api.get("/subscriptions"),
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
      setExpenses(expenseRes.data.expenses);
      setSummary(nextSummary);
      setAdvice(adviceRes.data.advice);
      setBudget(monthlyBudget > 0 ? { ...budgetRes.data, monthlyLimit: monthlyBudget } : budgetRes.data);
      setGoal(nextGoal);
      setSubscriptions([...onboardingSubscriptions, ...subscriptionRes.data.subscriptions]);
      setCalendarExpenses(calendarExpenseRes.data.expenses);
      setLastMonthExpenses(lastMonthExpenseRes.data.expenses);
    } catch (err) {
      if (err.response?.status === 401) {
        try {
          await startLocalSession();
          setError("");
        } catch (sessionErr) {
          setError(sessionErr.response?.data?.error?.message || "Could not reopen the local student profile.");
        }
      } else {
        setError(err.response?.data?.error?.message || "Could not load dashboard data.");
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

  async function saveExpense(payload) {
    setError("");
    try {
      if (editing) {
        await api.put(`/expenses/${editing.id}`, payload);
      } else {
        await api.post("/expenses", payload);
      }
      setEditing(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not save expense.");
    }
  }

  async function deleteExpense(id) {
    setError("");
    try {
      await api.delete(`/expenses/${id}`);
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
    const confirmed = window.confirm(`Remove ${matching.length} ${categoryName} spending entr${matching.length === 1 ? "y" : "ies"} totaling ${formatCurrency(total)}?`);
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
            <div>
              <p className="text-sm font-medium text-slate-400">Welcome back</p>
              <h1 className="text-3xl font-black tracking-normal text-white">{timeGreeting()}, {firstName(appUser?.name || user.name)}</h1>
            </div>
          </header>

          {error && <div className="rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{error}</div>}

          {activePath === "/dashboard" && (
            <OverviewDashboard
              appUser={appUser}
              summary={summary}
              expenses={expenses}
              calendarExpenses={calendarExpenses}
              lastMonthExpenses={lastMonthExpenses}
              subscriptions={subscriptions}
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

          {activePath === "/budget" && (
            <BudgetPage summary={summary} expenses={calendarExpenses} />
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
            <div className="grid gap-4 xl:grid-cols-2">
              <TrendChart data={summary.trend} />
              <CategoryChart data={summary.categories} />
              <div className="xl:col-span-2">
                <AdvicePanel advice={advice} />
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function OverviewDashboard({ appUser, summary, expenses, calendarExpenses, lastMonthExpenses, subscriptions, goal, categories, onAddSpending, onNavigate }) {
  const onboarding = getOnboarding();
  const monthlyIncome = Number(onboarding?.monthlyIncome || 0);
  const subscriptionTotal = subscriptions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const monthDelta = summary.monthlyTotal - lastMonthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
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
        <AccountsCard
          income={monthlyIncome}
          spending={summary.monthlyTotal}
          savings={goal.currentAmount}
          subscriptions={subscriptionTotal}
        />
        <UpcomingCard subscriptions={subscriptions} onNavigate={onNavigate} />
        <BudgetSummaryCard income={monthlyIncome} summary={summary} onNavigate={onNavigate} />
      </aside>
    </div>
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

function AccountsCard({ income, spending, savings, subscriptions }) {
  const cash = Math.max(0, income - spending);
  const cardBalance = Math.max(0, subscriptions);
  const netBalance = cash + Number(savings || 0) - cardBalance;
  const rows = [
    { label: "Cash", amount: cash, icon: WalletCards, positive: true },
    { label: "Card Balance", amount: cardBalance, icon: CreditCard },
    { label: "Net Balance", amount: netBalance, icon: Landmark, positive: netBalance >= 0 },
    { label: "Savings", amount: savings || 0, icon: PiggyBank, positive: true }
  ];

  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold tracking-normal">Accounts</h2>
      <div className="mt-4 divide-y divide-white/10">
        {rows.map(({ label, amount, icon: Icon, positive }) => (
          <div key={label} className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-3 text-sm font-semibold text-slate-200">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/8 text-violet-200"><Icon size={17} /></span>
              {label}
            </span>
            <span className={`text-sm font-bold tabular-nums ${positive ? "text-emerald-300" : "text-slate-100"}`}>{formatCurrency(amount)}</span>
          </div>
        ))}
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
                    <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: item.categoryColor || "#8b5cf6" }}>
                      {categoryInitial(item.category)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-100">{item.note || item.category}</p>
                      <p className="truncate text-xs text-slate-500">{item.category} / {item.paymentMethod}</p>
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
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    categoryId: categories[0]?.id || "",
    date: localDateString(),
    note: "",
    paymentMethod: "upi"
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm((current) => ({ ...current, categoryId: current.categoryId || categories[0]?.id || "" }));
  }, [categories]);

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
                  {categories.map((category) => (
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
              <button className="btn-primary" disabled={saving || categories.length === 0}>
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

function BudgetSummaryCard({ income, summary, onNavigate }) {
  const remainingPercent = summary.monthlyBudget ? Math.max(0, Math.round((summary.remainingBudget / summary.monthlyBudget) * 100)) : 0;

  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold tracking-normal">Budget</h2>
      <div className="mt-4 space-y-4">
        <ProgressRow label="Monthly income" value={formatCurrency(income)} percent={100} tone="bg-emerald-400" />
        <ProgressRow label="Monthly spending" value={formatCurrency(summary.monthlyTotal)} percent={Math.min(100, summary.budgetUsedPercent || 0)} tone="bg-violet-400" />
        <ProgressRow label="Remaining budget" value={formatCurrency(summary.remainingBudget)} percent={remainingPercent} tone="bg-sky-400" />
      </div>
      <p className="mt-4 text-sm text-slate-400">{summary.budgetUsedPercent.toFixed(1)}% of monthly budget used.</p>
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

function ProgressRow({ label, value, percent, tone }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="font-bold tabular-nums text-slate-100">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}

function SpendingAnalyticsPage({ summary, expenses, lastMonthExpenses, subscriptions, calendarMonth, selectedDate, onMonthChange, onToday, onDateSelect, onRemoveCategorySpending }) {
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const onboarding = getOnboarding();
  const income = Number(onboarding?.monthlyIncome || 0);
  const billsTotal = subscriptions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const analysisRows = buildCategoryAnalysis(expenses, lastMonthExpenses, subscriptions);
  const highest = analysisRows[0];
  const frequent = buildFrequentSpend(expenses);
  const remaining = Math.max(0, summary.monthlyBudget - summary.monthlyTotal);
  const budgetDelta = summary.monthlyBudget - summary.monthlyTotal;

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
            <div className="mt-4 grid items-center gap-5 lg:grid-cols-[1fr_0.8fr]">
              <div className="relative h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analysisRows} dataKey="amount" nameKey="category" innerRadius={88} outerRadius={132} paddingAngle={2}>
                      {analysisRows.map((row, index) => (
                        <Cell key={row.category} fill={categoryShade(index)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#f8fafc" }}
                      labelStyle={{ color: "#f8fafc" }}
                      itemStyle={{ color: "#f8fafc" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">{highest?.category || "No spend"}</p>
                    <p className="mt-1 text-2xl font-black text-white">{formatCurrency(highest?.amount || 0)}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {analysisRows.slice(0, 6).map((row, index) => (
                  <div key={row.category} className="flex items-center justify-between rounded-2xl bg-white/8 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 font-semibold text-slate-200">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryShade(index) }} />
                      {row.category}
                    </span>
                    <span className="font-bold">{row.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <CategoryBreakdownTable rows={analysisRows} onRemoveCategorySpending={onRemoveCategorySpending} />
        </section>

        <aside className="space-y-4">
          <SummaryAnalyticsCard income={income} bills={billsTotal} spending={summary.monthlyTotal} remaining={remaining} />
          <FrequentSpendCard rows={frequent} />
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Bot className="text-violet-300" size={20} />
              <h2 className="text-lg font-bold tracking-normal">Budget Insight</h2>
            </div>
            <div className="mt-4 space-y-2">
              <p className="rounded-2xl bg-white/8 p-3 text-sm leading-6 text-slate-300">
                {budgetDelta >= 0 ? `You are ${formatCurrency(budgetDelta)} under your monthly budget.` : `You are ${formatCurrency(Math.abs(budgetDelta))} over your monthly budget.`}
              </p>
              <p className="rounded-2xl bg-white/8 p-3 text-sm leading-6 text-slate-300">
                {highest ? `${highest.category} is ${highest.percent.toFixed(1)}% of your total spending.` : "Add expenses to see category insights."}
              </p>
              <p className="rounded-2xl bg-white/8 p-3 text-sm leading-6 text-slate-300">
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
                          style={{ backgroundColor: isSelected ? "#ffffff" : expense.categoryColor || categoryShade(index) }}
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
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: expense.categoryColor || categoryShade(index) }} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-100">{expense.note || expense.category || "Spending"}</span>
                      <span className="text-xs text-slate-400">{expense.category || "Other"} - {expense.paymentMethod || "payment"}</span>
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
                    <span className="grid h-9 w-9 place-items-center rounded-full text-xs font-black text-white" style={{ backgroundColor: categoryShade(index) }}>{categoryInitial(row.category)}</span>
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

function SummaryAnalyticsCard({ income, bills, spending, remaining }) {
  const rows = [
    { icon: WalletCards, label: "Income", helper: "Monthly setup income", amount: income, tone: "text-emerald-300" },
    { icon: CalendarClock, label: "Bills", helper: "Recurring charges", amount: bills, tone: "text-slate-100" },
    { icon: ReceiptText, label: "Spending", helper: "This month expenses", amount: spending, tone: "text-slate-100" },
    { icon: PiggyBank, label: "Remaining", helper: "Budget left", amount: remaining, tone: "text-violet-200" }
  ];

  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold tracking-normal">Summary</h2>
      <div className="mt-4 divide-y divide-white/10">
        {rows.map(({ icon: Icon, label, helper, amount, tone }) => (
          <div key={label} className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/8 text-violet-200"><Icon size={17} /></span>
              <span>
                <span className="block text-sm font-bold text-slate-100">{label}</span>
                <span className="text-xs text-slate-500">{helper}</span>
              </span>
            </span>
            <span className={`text-sm font-black tabular-nums ${tone}`}>{formatCurrency(amount)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FrequentSpendCard({ rows }) {
  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold tracking-normal">Frequent Spend</h2>
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl bg-white/8 p-3 text-sm text-slate-400">No frequent spend patterns yet.</p>
        ) : rows.map((row) => (
          <div key={row.label} className="rounded-2xl bg-white/8 p-3">
            <p className="text-sm font-semibold text-slate-200">You spent on {row.label} {row.count} time{row.count === 1 ? "" : "s"} this month.</p>
            <p className="mt-1 text-xs font-bold text-violet-200">{formatCurrency(row.amount)}</p>
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

      <div className="mt-auto rounded-3xl border border-violet-400/20 bg-violet-500/10 p-4">
        <BarChart3 className="text-violet-200" size={22} />
        <p className="mt-3 text-sm font-bold text-white">Monthly overview</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">Track spending, recurring costs, and savings in one place.</p>
      </div>
    </aside>
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

function PreferencesPage({ user, onBack, onLogout }) {
  const onboarding = getOnboarding();

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
    "/spending": "Spending analytics",
    "/reports/spending": "Spending analytics",
    "/budget": "Budget",
    "/savings": "Savings",
    "/subscriptions": "Recurring",
    "/reports": "Reports"
  };
  return titles[path] || "Dashboard";
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
  subscriptions.forEach((item) => {
    totals.Subscriptions = (totals.Subscriptions || 0) + Number(item.amount || 0);
  });
  const total = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  return Object.entries(totals)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: total ? (amount / total) * 100 : 0,
      change: amount - (previous[category] || 0)
    }))
    .sort((a, b) => b.amount - a.amount);
}

function groupByCategory(rows) {
  return rows.reduce((acc, item) => {
    const category = item.category || "Other";
    acc[category] = (acc[category] || 0) + Number(item.amount || 0);
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

function categoryInitial(category = "?") {
  return category.slice(0, 1).toUpperCase();
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
