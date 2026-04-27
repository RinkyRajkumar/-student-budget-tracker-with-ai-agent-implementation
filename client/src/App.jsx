import { Plus, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdvicePanel from "./components/AdvicePanel.jsx";
import BudgetPanel from "./components/BudgetPanel.jsx";
import CalendarView from "./components/CalendarView.jsx";
import { CategoryChart, TrendChart } from "./components/Charts.jsx";
import ExpenseForm from "./components/ExpenseForm.jsx";
import ExpenseList from "./components/ExpenseList.jsx";
import StatCard from "./components/StatCard.jsx";
import SubscriptionsPanel from "./components/SubscriptionsPanel.jsx";
import SplitBillsPanel from "./components/SplitBillsPanel.jsx";
import { api, downloadCsv, readUser, saveSession } from "./services/api.js";
import { formatCurrency } from "./services/currency.js";
import { addMonths, formatMonthLabel, localDateString, localMonthString, monthBounds } from "./services/dates.js";

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

export default function App() {
  const [user, setUser] = useState(readUser());
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [calendarExpenses, setCalendarExpenses] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [splitBills, setSplitBills] = useState({ groups: [], bills: [], balances: [], settlements: [], analytics: {}, insights: [] });
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
      const [categoryRes, expenseRes, summaryRes, adviceRes, budgetRes, goalRes, subscriptionRes, splitBillRes, calendarExpenseRes] = await Promise.all([
        api.get("/categories"),
        api.get("/expenses", { params: queryFilters }),
        api.get("/summary", { params: { month: calendarMonth } }),
        api.get("/advice", { params: { month: calendarMonth } }),
        api.get("/budget"),
        api.get("/savings-goal"),
        api.get("/subscriptions"),
        api.get("/split-bills"),
        api.get("/expenses", { params: { from: calendarRange.start, to: calendarRange.end } })
      ]);
      setCategories(categoryRes.data.categories);
      setExpenses(expenseRes.data.expenses);
      setSummary(summaryRes.data.summary);
      setAdvice(adviceRes.data.advice);
      setBudget(budgetRes.data);
      setGoal(goalRes.data.goal);
      setSubscriptions(subscriptionRes.data.subscriptions);
      setSplitBills(splitBillRes.data);
      setCalendarExpenses(calendarExpenseRes.data.expenses);
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

  async function deleteSubscription(id) {
    await api.delete(`/subscriptions/${id}`);
    await loadData();
  }

  async function createSplitGroup(payload) {
    const response = await api.post("/split-bills/groups", payload);
    setSplitBills(response.data);
    return response.data;
  }

  async function addSplitMember(groupId, name) {
    const response = await api.post(`/split-bills/groups/${groupId}/members`, { name });
    setSplitBills(response.data);
  }

  async function removeSplitMember(groupId, memberId) {
    const response = await api.delete(`/split-bills/groups/${groupId}/members/${memberId}`);
    setSplitBills(response.data);
  }

  async function createSplitBill(payload) {
    const response = await api.post("/split-bills/bills", payload);
    setSplitBills(response.data);
    await loadData();
  }

  async function settleSplitBill(payload) {
    const response = await api.post("/split-bills/settlements", payload);
    setSplitBills(response.data);
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

  const remainingTone = summary.budgetStatus === "over" ? "rose" : summary.budgetStatus === "near" ? "amber" : "mint";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.22),transparent_32rem),linear-gradient(180deg,#070816_0%,#111827_48%,#070816_100%)] pb-24 text-slate-100 md:pb-6">
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 md:grid-cols-[1.35fr_0.85fr] md:px-6 md:py-6">
        <section className="space-y-4">
          <header className="flex min-h-16 items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-violet-300">Local profile: {user.name}</p>
              <h1 className="text-2xl font-bold tracking-normal">{formatMonthLabel(calendarMonth)} spending</h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-soft px-3" onClick={loadData} disabled={loading} aria-label="Refresh dashboard">
                <RefreshCcw size={16} />
              </button>
            </div>
          </header>

          {error && <div className="rounded-lg bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{error}</div>}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Left this month"
              value={formatCurrency(summary.remainingBudget)}
              helper={`${formatCurrency(summary.safeToSpendPerDay)} safe per day`}
              tone={remainingTone}
            />
            <StatCard label="Today" value={formatCurrency(summary.dailyTotal)} helper="Daily spending" tone="sky" />
            <StatCard label="This week" value={formatCurrency(summary.weeklyTotal)} helper="Last 7 days" />
            <StatCard label="This month" value={formatCurrency(summary.monthlyTotal)} helper={`${summary.budgetUsedPercent.toFixed(1)}% of budget`} />
          </section>

          <CalendarView
            month={calendarMonth}
            expenses={calendarExpenses}
            selectedDate={selectedDate}
            onMonthChange={changeCalendarMonth}
            onToday={jumpToToday}
            onDateSelect={selectCalendarDate}
            onEditExpense={setEditing}
          />
          <ExpenseForm
            categories={categories}
            editing={editing}
            selectedDate={selectedDate}
            onSubmit={saveExpense}
            onCancel={() => setEditing(null)}
          />
          <ExpenseList
            expenses={expenses}
            categories={categories}
            filters={filters}
            setFilters={setFilters}
            onEdit={setEditing}
            onDelete={deleteExpense}
            onExport={async () => {
              try {
                await downloadCsv(queryFilters);
              } catch (err) {
                setError(err.response?.data?.error?.message || "Could not export CSV.");
              }
            }}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <TrendChart data={summary.trend} />
            <CategoryChart data={summary.categories} />
          </div>
        </section>

        <aside className="space-y-4">
          <BudgetPanel budget={budget} goal={goal} summary={summary} onBudgetSave={saveBudget} onGoalSave={saveGoal} />
          <SubscriptionsPanel
            categories={categories}
            subscriptions={subscriptions}
            onCreate={createSubscription}
            onDelete={deleteSubscription}
          />
          <SplitBillsPanel
            data={splitBills}
            selectedDate={selectedDate}
            onCreateGroup={createSplitGroup}
            onAddMember={addSplitMember}
            onRemoveMember={removeSplitMember}
            onCreateBill={createSplitBill}
            onSettle={settleSplitBill}
          />
          <AdvicePanel advice={advice} />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-lg md:hidden">
        <button className="btn-primary w-full" onClick={() => window.scrollTo({ top: 210, behavior: "smooth" })}>
          <Plus size={17} />
          Add expense
        </button>
      </div>
    </main>
  );
}
