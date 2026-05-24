import { ArrowLeft, ArrowRight, Check, Plus, RotateCcw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency } from "../services/currency.js";
import { readSpendlyCategories, saveSpendlyCategories } from "../services/categories.js";

const STORAGE_KEY = "spendly_budget_categories";
const commonCategorySections = {
  Popular: ["Food", "Groceries", "Transport", "Rent", "Tuition", "Books", "Shopping", "Entertainment"],
  Household: ["Bills", "Utilities", "Internet", "Mobile Recharge", "Fuel"],
  Student: ["College Canteen", "Stationery", "Hostel", "Online Courses", "Exam Fees"],
  Bills: ["Subscriptions", "Medical", "Health", "Fitness", "Travel", "Savings", "Other"]
};
const categoryColors = ["#8b5cf6", "#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#38bdf8"];

const groups = [
  { name: "BUDGET BASICS", items: ["Earnings", "Bills & Utilities"] },
  { name: "Housing", items: ["Rent / House EMI", "Maintenance Charges"] },
  { name: "Utilities", items: ["Electricity Bill", "Water Bill", "LPG / Gas Cylinder", "Internet / Wi-Fi", "Mobile Recharge", "DTH / Cable TV"] },
  { name: "Food", items: ["Groceries", "Vegetables", "Fruits", "Milk & Dairy", "Meat / Fish / Eggs", "Snacks & Packaged Foods", "Food Delivery", "Restaurants / Eating Out", "Tea / Coffee"] },
  { name: "Household", items: ["Household Cleaning Items", "Toiletries", "Laundry", "Maid / House Help", "Cook Salary", "Driver Salary"] },
  { name: "Transport", items: ["Fuel / Petrol / Diesel", "Public Transport", "Cab / Auto / Rapido", "Vehicle EMI", "Vehicle Maintenance", "Parking / Toll"] },
  { name: "Education", items: ["School / College Fees", "Tuition / Coaching", "Books & Stationery", "Online Courses"] },
  { name: "Health", items: ["Medical Expenses", "Medicines", "Health Insurance", "Life Insurance", "Gym / Fitness"] },
  { name: "Lifestyle", items: ["Clothing", "Footwear", "Personal Care / Salon", "Entertainment", "Shopping", "Gifts", "Festivals / Religious Expenses", "Travel / Trips"] },
  { name: "Subscriptions", items: ["OTT Subscriptions", "Music Subscriptions"] },
  { name: "Savings", items: ["Savings / Investments", "Emergency Fund"] }
];

const defaults = Object.fromEntries(groups.flatMap((group) => group.items).map((name) => [name, defaultBudget(name)]));

export default function BudgetPage({ summary, expenses }) {
  const [month, setMonth] = useState(new Date(2026, 0, 1));
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [budgets, setBudgets] = useState(readBudgets);
  const [localCategories, setLocalCategories] = useState(readSpendlyCategories);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const actuals = useMemo(() => buildActuals(expenses), [expenses]);
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: [...group.items, ...(group.name === "Lifestyle" ? localCategories.map((item) => item.name) : [])].filter((item) => item.toLowerCase().includes(query.toLowerCase()))
    }))
    .filter((group) => group.items.length);

  const totals = useMemo(() => {
    const spendingBudget = Object.entries(budgets)
      .filter(([name]) => name !== "Earnings")
      .reduce((sum, [, value]) => sum + Number(value || 0), 0);
    const currentSpend = Object.values(actuals).reduce((sum, value) => sum + Number(value || 0), 0) || summary.monthlyTotal;
    const remaining = spendingBudget - currentSpend;
    const daysRemaining = summary.daysRemaining || 1;
    return { spendingBudget, currentSpend, remaining, daysRemaining, safePerDay: remaining / daysRemaining };
  }, [actuals, budgets, summary]);

  function saveBudget(name, value) {
    const next = { ...budgets, [name]: Number(value || 0) };
    setBudgets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function resetBudget() {
    setBudgets(defaults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  }

  function addCategory() {
    setCategoryModalOpen(true);
  }

  function commitCategories(rows) {
    const existing = new Set(localCategories.map((item) => item.name.toLowerCase()));
    const nextRows = rows.filter((item) => !existing.has(item.name.toLowerCase()));
    if (!nextRows.length) return;
    const next = [...localCategories, ...nextRows];
    setLocalCategories(next);
    saveSpendlyCategories(next);
    const nextBudgets = { ...budgets };
    nextRows.forEach((item) => {
      nextBudgets[item.name] = nextBudgets[item.name] || 0;
    });
    setBudgets(nextBudgets);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBudgets));
  }

  return (
    <section className="min-h-screen rounded-[28px] bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.20),transparent_30rem),linear-gradient(180deg,#070816_0%,#111827_54%,#070816_100%)] p-4 text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.28)] md:p-6">
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <h2 className="text-2xl font-black tracking-normal text-white">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })} Budget</h2>
        <div className="flex items-center justify-center gap-2">
          <button className="rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-slate-200 shadow-sm transition hover:bg-violet-500/20" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
            <ArrowLeft size={15} />
          </button>
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-slate-100 shadow-sm">{month.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
          <button className="rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-slate-200 shadow-sm transition hover:bg-violet-500/20" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4 xl:order-1">
          <div className="rounded-[24px] border border-violet-300/15 bg-slate-950/75 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
                <input className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 pl-10 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20" placeholder="Search budget category..." value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-violet-500/20" onClick={addCategory}><Plus size={17} /> Add Category</button>
              <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500/15 px-4 py-2 text-sm font-bold text-rose-200 transition hover:bg-rose-500/25" onClick={resetBudget}><RotateCcw size={17} /> Reset Budget</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-violet-300/15 bg-slate-950/75 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur">
            <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_54px] border-b border-white/10 bg-white/5 px-5 py-4 text-xs font-black text-slate-400 md:grid">
              <span>Name</span>
              <span>Budgeted</span>
              <span>Actual</span>
              <span>Remaining</span>
              <span />
            </div>
            <div className="divide-y divide-white/10">
              {filteredGroups.map((group) => (
                <div key={group.name}>
                  <button className="flex w-full items-center justify-between bg-violet-500/10 px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-violet-200" onClick={() => setCollapsed({ ...collapsed, [group.name]: !collapsed[group.name] })}>
                    {group.name}
                    <span>{collapsed[group.name] ? "+" : "-"}</span>
                  </button>
                  {!collapsed[group.name] && group.items.map((name, index) => (
                    <BudgetRow key={name} name={name} budgeted={budgets[name] || 0} actual={actuals[name] || 0} index={index} onBudgetChange={saveBudget} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <BudgetSummary totals={totals} />
      </div>
      {categoryModalOpen && (
        <AddCategoryModal
          existingNames={[...Object.keys(budgets), ...localCategories.map((item) => item.name)]}
          onClose={() => setCategoryModalOpen(false)}
          onAdd={(rows) => commitCategories(rows)}
        />
      )}
    </section>
  );
}

function AddCategoryModal({ existingNames, onClose, onAdd }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState(categoryColors[0]);
  const existing = new Set(existingNames.map((name) => name.toLowerCase()));

  function makeCategory(name, isCustom = false, color = categoryColors[selected.length % categoryColors.length]) {
    return {
      id: Date.now() + Math.floor(Math.random() * 100000),
      name,
      type: "expense",
      icon: name.slice(0, 1).toUpperCase(),
      color,
      isCustom,
      createdAt: new Date().toISOString()
    };
  }

  function toggle(name) {
    if (existing.has(name.toLowerCase())) return;
    setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  function addSelected() {
    onAdd(selected.map((name, index) => makeCategory(name, false, categoryColors[index % categoryColors.length])));
    setSelected([]);
  }

  function addCustom() {
    const name = customName.trim();
    if (!name || existing.has(name.toLowerCase())) return;
    onAdd([makeCategory(name, true, customColor)]);
    setCustomName("");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
      <section className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black text-white">Add Category</h3>
            <p className="mt-1 text-sm text-slate-400">Choose from common categories or create your own.</p>
          </div>
          <button className="btn-soft px-3" onClick={onClose}><X size={17} /></button>
        </div>
        <label className="relative mt-5 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
          <input className="input pl-10" placeholder="Search categories..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>

        <div className="mt-5 space-y-5">
          {Object.entries(commonCategorySections).map(([section, items]) => {
            const rows = items.filter((name) => name.toLowerCase().includes(search.toLowerCase()));
            if (!rows.length) return null;
            return (
              <div key={section}>
                <p className="mb-3 text-xs font-black uppercase tracking-wide text-violet-200">{section}</p>
                <div className="flex flex-wrap gap-2">
                  {rows.map((name) => {
                    const added = existing.has(name.toLowerCase());
                    const active = selected.includes(name);
                    return (
                      <button
                        key={name}
                        className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold transition ${added ? "cursor-not-allowed bg-white/5 text-slate-500" : active ? "bg-violet-500 text-white" : "bg-white/10 text-slate-200 hover:bg-violet-500/20"}`}
                        onClick={() => toggle(name)}
                        disabled={added}
                      >
                        {active && <Check size={15} />}
                        {name}
                        {added && <span className="text-xs">Added</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-violet-200">Custom</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input className="input" placeholder="Create custom category" value={customName} onChange={(event) => setCustomName(event.target.value)} />
            <select className="input" value={customColor} onChange={(event) => setCustomColor(event.target.value)}>
              {categoryColors.map((color) => <option key={color} value={color}>{color}</option>)}
            </select>
            <button className="btn-soft" onClick={addCustom}>Add Custom Category</button>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn-soft" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={addSelected} disabled={!selected.length}>Add Selected Categories</button>
        </div>
      </section>
    </div>
  );
}

function BudgetRow({ name, budgeted, actual, index, onBudgetChange }) {
  const remaining = Number(budgeted || 0) - Number(actual || 0);
  const percent = budgeted ? Math.min(100, Math.round((actual / budgeted) * 100)) : 0;
  return (
    <div className="grid gap-3 px-4 py-4 transition hover:bg-white/5 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_54px] md:items-center md:px-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: iconColor(index) }}>
          {name.slice(0, 1)}
        </span>
        <div>
          <p className="font-bold text-slate-100">{name}</p>
          <p className="text-xs text-slate-500">Monthly category</p>
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-slate-500 md:hidden">Budgeted</span>
        <input className="w-full rounded-xl border-0 border-b border-dotted border-slate-600 bg-transparent px-1 py-2 text-sm font-bold tabular-nums text-slate-100 outline-none focus:border-violet-400" type="number" min="0" value={budgeted} onChange={(event) => onBudgetChange(name, event.target.value)} />
      </label>
      <div>
        <span className="mb-1 block text-xs text-slate-500 md:hidden">Actual</span>
        <p className="font-bold tabular-nums text-slate-100">{formatCurrency(actual)}</p>
      </div>
      <div>
        <span className="mb-1 block text-xs text-slate-500 md:hidden">Remaining</span>
        <p className={`font-bold tabular-nums ${remaining >= 0 ? "text-emerald-300" : "text-amber-300"}`}>{formatCurrency(remaining)}</p>
      </div>
      <div className="flex md:justify-end">
        <ProgressDot percent={percent} overspent={remaining < 0} />
      </div>
    </div>
  );
}

function BudgetSummary({ totals }) {
  const percent = totals.spendingBudget ? Math.min(100, Math.round((totals.currentSpend / totals.spendingBudget) * 100)) : 0;
  return (
    <aside className="rounded-[24px] border border-violet-300/15 bg-slate-950/75 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur xl:sticky xl:top-6 xl:order-2 xl:self-start">
      <p className="mb-4 text-xs font-black uppercase tracking-wide text-violet-200">Summary</p>
      <div className="grid place-items-center">
        <div className="relative grid h-44 w-44 place-items-center rounded-full bg-violet-500/10">
          <ProgressRing percent={percent} />
          <div className="absolute text-center">
            <p className="text-xs font-bold uppercase text-slate-500">Left to Spend</p>
            <p className={`mt-1 text-2xl font-black ${totals.remaining >= 0 ? "text-slate-100" : "text-amber-300"}`}>{formatCurrency(totals.remaining)}</p>
            <p className="mt-1 text-xs text-slate-500">of {formatCurrency(totals.spendingBudget)}</p>
          </div>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <SummaryLine label="Total Spending Budget" value={totals.spendingBudget} />
        <SummaryLine label="Current Spend" value={totals.currentSpend} />
        <SummaryLine label="Remaining" value={totals.remaining} highlight />
      </div>
      <p className="mt-5 rounded-3xl bg-violet-500/10 p-4 text-center text-sm leading-6 text-violet-100">
        That's {formatCurrency(totals.safePerDay)}/day for the next {totals.daysRemaining} days of the month.
      </p>
    </aside>
  );
}

function SummaryLine({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between border-t border-white/10 px-1 py-4">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className={`font-black tabular-nums ${highlight && value >= 0 ? "text-emerald-300" : highlight ? "text-amber-300" : "text-slate-100"}`}>{formatCurrency(value)}</span>
    </div>
  );
}

function ProgressRing({ percent }) {
  const degrees = Math.round((percent / 100) * 360);
  return <div className="h-44 w-44 rounded-full" style={{ background: `conic-gradient(#8b5cf6 ${degrees}deg, rgba(255,255,255,0.08) 0deg)` }} />;
}

function ProgressDot({ percent, overspent }) {
  const degrees = Math.round((percent / 100) * 360);
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: `conic-gradient(${overspent ? "#f59e0b" : "#8b5cf6"} ${degrees}deg, rgba(255,255,255,0.12) 0deg)` }}>
      <span className="h-5 w-5 rounded-full bg-slate-950" />
    </span>
  );
}

function readBudgets() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return defaults;
  }
}

function defaultBudget(name) {
  if (name === "Earnings") return 50000;
  if (name.includes("Rent") || name.includes("EMI")) return 12000;
  if (name.includes("Savings") || name.includes("Emergency")) return 5000;
  if (name.includes("Groceries")) return 6000;
  if (name.includes("Fees")) return 10000;
  return 1500;
}

function buildActuals(expenses = []) {
  const actuals = {};
  expenses.forEach((expense) => {
    const name = mapExpenseToBudgetName(expense);
    actuals[name] = (actuals[name] || 0) + Number(expense.amount || 0);
  });
  return actuals;
}

function mapExpenseToBudgetName(expense) {
  const text = `${expense.category || ""} ${expense.note || ""}`.toLowerCase();
  if (/rent|emi/.test(text)) return "Rent / House EMI";
  if (/electric/.test(text)) return "Electricity Bill";
  if (/water/.test(text)) return "Water Bill";
  if (/gas|lpg/.test(text)) return "LPG / Gas Cylinder";
  if (/internet|wi-fi|wifi/.test(text)) return "Internet / Wi-Fi";
  if (/mobile|recharge/.test(text)) return "Mobile Recharge";
  if (/grocery|groceries/.test(text)) return "Groceries";
  if (/vegetable/.test(text)) return "Vegetables";
  if (/fruit/.test(text)) return "Fruits";
  if (/milk|dairy/.test(text)) return "Milk & Dairy";
  if (/food delivery|zomato|swiggy/.test(text)) return "Food Delivery";
  if (/restaurant|eating|cafe|coffee|tea/.test(text)) return "Restaurants / Eating Out";
  if (/transport|metro|bus/.test(text)) return "Public Transport";
  if (/cab|auto|rapido|uber|ola/.test(text)) return "Cab / Auto / Rapido";
  if (/book|stationery/.test(text)) return "Books & Stationery";
  if (/tuition|college|school/.test(text)) return "School / College Fees";
  if (/medicine|medical|health/.test(text)) return "Medical Expenses";
  if (/spotify|music/.test(text)) return "Music Subscriptions";
  if (/netflix|ott|prime|subscription/.test(text)) return "OTT Subscriptions";
  if (/shopping/.test(text)) return "Shopping";
  if (/travel|trip/.test(text)) return "Travel / Trips";
  return expense.category === "Food" ? "Groceries" : expense.category === "Transport" ? "Public Transport" : expense.category === "Books" ? "Books & Stationery" : expense.category === "Subscriptions" ? "OTT Subscriptions" : "Shopping";
}

function iconColor(index) {
  return ["#8b5cf6", "#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#38bdf8", "#a78bfa"][index % 7];
}
