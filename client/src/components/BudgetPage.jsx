import { ArrowLeft, ArrowRight, Check, Edit3, Plus, RotateCcw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import CategoryBadge, { getCategoryMeta } from "./CategoryBadge.jsx";
import { formatCurrency } from "../services/currency.js";
import { readSpendlyCategories, saveSpendlyCategories } from "../services/categories.js";
import { confirmSpendly } from "../services/confirmDialog.js";

const STORAGE_KEY = "spendly_budget_categories";
const BUDGET_UPDATED_EVENT = "spendly-budget-updated";
const HIDDEN_ROWS_KEY = "spendly_hidden_budget_rows";
const DEFAULT_BUDGET_MIGRATION_KEY = "spendly_budget_defaults_removed_v1";
const SIMPLIFIED_BUDGET_MIGRATION_KEY = "spendly_budget_simplified_v1";
const commonCategorySections = {
  Popular: ["Food", "Transport", "Bills & Utilities", "Rent / Housing", "Education", "Health"],
  Lifestyle: ["Shopping", "Entertainment", "Subscriptions", "Savings", "Travel", "Other"],
  Student: ["College Canteen", "Hostel", "Exam Fees"]
};
const categoryColors = ["#8b5cf6", "#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#38bdf8"];

const mainCategories = [
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

const advancedCategories = {
  Food: ["Groceries", "Food Delivery", "Restaurants"],
  Transport: ["Fuel", "Public Transport", "Cab / Auto", "Vehicle EMI", "Parking"],
  "Bills & Utilities": ["Electricity", "Water", "LPG / Gas", "Internet", "Mobile Recharge", "DTH / Cable"],
  "Rent / Housing": ["Rent", "House EMI", "Maintenance"],
  Education: ["School / College Fees", "Tuition", "Books", "Online Courses"],
  Health: ["Medical", "Medicines", "Health Insurance", "Gym"],
  Shopping: ["Clothing", "Footwear", "Personal Care"],
  Entertainment: ["Movies / Events", "Gifts"],
  Subscriptions: ["OTT", "Music", "Cloud / Apps"],
  Savings: ["Investments", "Emergency Fund"],
  Travel: ["Trips"],
  Other: []
};

const groups = [
  { name: "Basic Categories", items: ["Earnings", "Budget"] },
  { name: "Budget Categories", items: mainCategories }
];
const advancedCategoryNames = Object.values(advancedCategories).flat();
const defaultCategoryNames = ["Earnings", "Budget", ...mainCategories, ...advancedCategoryNames];
const legacyDetailedCategoryNames = [
  "Earnings",
  "Rent / House EMI",
  "Maintenance Charges",
  "Electricity Bill",
  "Water Bill",
  "LPG / Gas Cylinder",
  "Internet / Wi-Fi",
  "Mobile Recharge",
  "DTH / Cable TV",
  "Groceries",
  "Vegetables",
  "Fruits",
  "Milk & Dairy",
  "Meat / Fish / Eggs",
  "Snacks & Packaged Foods",
  "Food Delivery",
  "Restaurants / Eating Out",
  "Tea / Coffee",
  "Household Cleaning Items",
  "Toiletries",
  "Laundry",
  "Maid / House Help",
  "Cook Salary",
  "Driver Salary",
  "Fuel / Petrol / Diesel",
  "Public Transport",
  "Cab / Auto / Rapido",
  "Vehicle EMI",
  "Vehicle Maintenance",
  "Parking / Toll",
  "School / College Fees",
  "Tuition / Coaching",
  "Books & Stationery",
  "Online Courses",
  "Medical Expenses",
  "Medicines",
  "Health Insurance",
  "Life Insurance",
  "Gym / Fitness",
  "Clothing",
  "Footwear",
  "Personal Care / Salon",
  "Gifts",
  "Festivals / Religious Expenses",
  "Travel / Trips",
  "OTT Subscriptions",
  "Music Subscriptions",
  "Savings / Investments",
  "Emergency Fund"
];

export default function BudgetPage({ summary, expenses, subscriptions = [] }) {
  const [month, setMonth] = useState(new Date(2026, 0, 1));
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [budgets, setBudgets] = useState(readBudgets);
  const [localCategories, setLocalCategories] = useState(readSpendlyCategories);
  const [hiddenRows, setHiddenRows] = useState(readHiddenRows);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const actuals = useMemo(() => buildActuals(expenses, subscriptions), [expenses, subscriptions]);
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: buildBudgetRows({ group, localCategories, hiddenRows }).filter((item) => item.name.toLowerCase().includes(query.toLowerCase()) || item.parent?.toLowerCase().includes(query.toLowerCase()))
    }))
    .filter((group) => group.items.length);

  const categoryBudgetTotal = useMemo(() => {
    const budgetCategoryNames = new Set(
      buildBudgetRows({ group: groups.find((group) => group.name === "Budget Categories"), localCategories, hiddenRows })
        .map((item) => item.name)
    );
    return [...budgetCategoryNames].reduce((sum, name) => sum + Number(budgets[name] || 0), 0);
  }, [budgets, hiddenRows, localCategories]);

  const mainCategorySpend = useMemo(() => (
    mainCategories.reduce((sum, name) => sum + Number(actuals[name] || 0), 0)
  ), [actuals]);

  const totals = useMemo(() => {
    const spendingBudget = categoryBudgetTotal;
    const currentSpend = Math.max(Number(summary.monthlyTotal || 0), mainCategorySpend);
    const remaining = spendingBudget - currentSpend;
    const daysRemaining = summary.daysRemaining || 1;
    return { spendingBudget, currentSpend, remaining, daysRemaining, safePerDay: remaining / daysRemaining };
  }, [categoryBudgetTotal, mainCategorySpend, summary]);

  function saveBudget(name, value) {
    if (name === "Budget") return;
    const next = { ...budgets };
    if (value === "") delete next[name];
    else next[name] = Number(value || 0);
    setBudgets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notifyBudgetUpdated();
  }

  function resetBudget() {
    setBudgets({});
    localStorage.setItem(STORAGE_KEY, JSON.stringify({}));
    notifyBudgetUpdated();
    setHiddenRows([]);
    localStorage.setItem(HIDDEN_ROWS_KEY, JSON.stringify([]));
  }

  async function removeBudgetRow(name) {
    const confirmed = await confirmSpendly({
      title: `Remove ${name}?`,
      message: "This budget row will be removed from your Budget page. Existing spending entries will not be deleted.",
      confirmLabel: "Remove",
      tone: "danger"
    });
    if (!confirmed) return;
    const nextBudgets = { ...budgets };
    delete nextBudgets[name];
    setBudgets(nextBudgets);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBudgets));
    notifyBudgetUpdated();

    const nextCategories = localCategories.filter((item) => item.name !== name);
    if (nextCategories.length !== localCategories.length) {
      setLocalCategories(nextCategories);
      saveSpendlyCategories(nextCategories);
    } else if (defaultCategoryNames.includes(name)) {
      const nextHiddenRows = [...new Set([...hiddenRows, name])];
      setHiddenRows(nextHiddenRows);
      localStorage.setItem(HIDDEN_ROWS_KEY, JSON.stringify(nextHiddenRows));
    }
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
      if (!(item.name in nextBudgets)) nextBudgets[item.name] = "";
    });
    setBudgets(nextBudgets);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBudgets));
    notifyBudgetUpdated();
  }

  return (
    <section className="min-h-screen rounded-[28px] bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.20),transparent_30rem),linear-gradient(180deg,#070816_0%,#111827_54%,#070816_100%)] p-4 text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.28)] md:p-6">
      <div className="mb-6 flex justify-center">
        <div className="flex items-center gap-2">
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
                  {!collapsed[group.name] && group.items.map((item, index) => {
                    const isComputedBudget = item.name === "Budget";
                    return (
                      <BudgetRow
                        key={item.name}
                        name={item.name}
                        parent={item.parent}
                        isSubcategory={item.isSubcategory}
                        isDefault={defaultCategoryNames.includes(item.name)}
                        budgeted={isComputedBudget ? categoryBudgetTotal : budgets[item.name] ?? ""}
                        actual={isComputedBudget ? totals.currentSpend : actuals[item.name] || 0}
                        index={index}
                        readOnly={isComputedBudget}
                        onBudgetChange={saveBudget}
                        onRemove={removeBudgetRow}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <BudgetSummary totals={totals} />
      </div>
      {categoryModalOpen && (
        <AddCategoryModal
          existingNames={[...mainCategories, ...advancedCategoryNames, ...Object.keys(budgets), ...localCategories.map((item) => item.name)]}
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
    const meta = getCategoryMeta(name);
    return {
      id: Date.now() + Math.floor(Math.random() * 100000),
      name,
      type: "expense",
      icon: meta.icon?.displayName || "CircleEllipsis",
      color: meta.color || color,
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
                        <CategoryBadge category={name} size={24} iconSize={12} />
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

function BudgetRow({ name, parent, isSubcategory, isDefault, budgeted, actual, index, readOnly = false, onBudgetChange, onRemove }) {
  const remaining = Number(budgeted || 0) - Number(actual || 0);
  const inputId = `budget-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={`group relative grid gap-3 px-4 py-4 transition hover:bg-white/5 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_54px] md:items-center md:px-5 ${isSubcategory ? "bg-white/[0.025] md:pl-10" : ""}`}>
      <div className="flex items-center gap-3">
        <CategoryBadge category={name} size={isSubcategory ? 32 : 40} iconSize={18} />
        <div>
          <p className="font-bold text-slate-100">{name}</p>
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-slate-500 md:hidden">Budgeted</span>
        {readOnly ? (
          <p className="px-1 py-2 text-sm font-black tabular-nums text-violet-100">{formatCurrency(budgeted)}</p>
        ) : (
          <input id={inputId} className="w-full rounded-xl border-0 border-b border-dotted border-slate-600 bg-transparent px-1 py-2 text-sm font-bold tabular-nums text-slate-100 outline-none focus:border-violet-400" type="number" min="0" value={budgeted} onChange={(event) => onBudgetChange(name, event.target.value)} />
        )}
      </label>
      <div>
        <span className="mb-1 block text-xs text-slate-500 md:hidden">Actual</span>
        <p className="font-bold tabular-nums text-slate-100">{formatCurrency(actual)}</p>
      </div>
      <div>
        <span className="mb-1 block text-xs text-slate-500 md:hidden">Remaining</span>
        <p className={`font-bold tabular-nums ${remaining >= 0 ? "text-emerald-300" : "text-amber-300"}`}>{formatCurrency(remaining)}</p>
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        {!readOnly && (
          <>
            <button
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-rose-300/25 bg-rose-500/15 p-0 text-rose-200 opacity-0 shadow-lg transition hover:bg-rose-500/25 group-hover:opacity-100"
              type="button"
              aria-label={`Remove ${name}`}
              title={isDefault ? "Hide this budget row" : "Remove this custom budget row"}
              onClick={() => onRemove(name)}
            >
              <X size={14} />
            </button>
            <button
              className="grid h-8 w-8 place-items-center rounded-xl bg-white/8 text-slate-400 transition hover:bg-violet-500/20 hover:text-violet-100"
              type="button"
              aria-label={`Edit ${name} budget`}
              onClick={() => document.getElementById(inputId)?.focus()}
            >
              <Edit3 size={14} />
            </button>
          </>
        )}
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
        <div className="relative grid h-44 w-44 place-items-center rounded-full bg-white/[0.03]">
          <ProgressRing percent={percent} />
          <div className="absolute text-center">
            <p className="text-[10px] font-semibold leading-tight text-slate-400">Left to Spend</p>
            <p className={`mt-1 text-2xl font-black leading-none tracking-tight ${totals.remaining >= 0 ? "text-white" : "text-amber-300"}`}>{formatCurrency(totals.remaining)}</p>
            <p className="mt-1 text-[10px] leading-tight text-slate-500">of {formatCurrency(totals.spendingBudget)}</p>
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
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, percent));
  const dashOffset = circumference - (progress / 100) * circumference;
  return (
    <svg className="h-44 w-44 -rotate-90 drop-shadow-[0_12px_28px_rgba(139,92,246,0.20)]" viewBox="0 0 176 176" aria-hidden="true">
      <defs>
        <linearGradient id="budgetRingGradient" x1="20" x2="156" y1="20" y2="156" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c4b5fd" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle cx="88" cy="88" r={radius} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="8" />
      <circle
        cx="88"
        cy="88"
        r={radius}
        fill="none"
        stroke="url(#budgetRingGradient)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
      />
    </svg>
  );
}

function buildBudgetRows({ group, localCategories, hiddenRows }) {
  const hidden = new Set(hiddenRows);
  const rows = [];
  group.items.forEach((name) => {
    if (hidden.has(name)) return;
    rows.push({ name, isSubcategory: false });
  });
  if (group.name === "Budget Categories") {
    localCategories.forEach((item) => {
      if (hidden.has(item.name)) return;
      if (!rows.some((row) => row.name.toLowerCase() === item.name.toLowerCase())) {
        rows.push({ name: item.name, parent: "Custom", isSubcategory: false });
      }
    });
  }
  return rows;
}

function readHiddenRows() {
  try {
    const rows = JSON.parse(localStorage.getItem(HIDDEN_ROWS_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function readBudgets() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!localStorage.getItem(DEFAULT_BUDGET_MIGRATION_KEY)) {
      const withoutGeneratedDefaults = Object.fromEntries(
        Object.entries(stored).filter(([name, value]) => !legacyDetailedCategoryNames.includes(name) || Number(value) !== defaultBudget(name))
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutGeneratedDefaults));
      localStorage.setItem(DEFAULT_BUDGET_MIGRATION_KEY, "true");
      return simplifyStoredBudgets(withoutGeneratedDefaults);
    }
    if (localStorage.getItem(SIMPLIFIED_BUDGET_MIGRATION_KEY)) return stored;
    return simplifyStoredBudgets(stored);
  } catch {
    return {};
  }
}

function notifyBudgetUpdated() {
  window.dispatchEvent(new Event(BUDGET_UPDATED_EVENT));
}

function simplifyStoredBudgets(stored) {
  const migrated = {};
  Object.entries(stored).forEach(([name, value]) => {
    const amount = Number(value || 0);
    if (!amount) return;
    if (legacyDetailedCategoryNames.includes(name) && Number(value) === defaultBudget(name)) return;
    if (name === "Earnings") {
      migrated.Budget = (migrated.Budget || 0) + amount;
      return;
    }
    const nextName = simplifyBudgetCategory(name);
    migrated[nextName] = (migrated[nextName] || 0) + amount;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  localStorage.setItem(SIMPLIFIED_BUDGET_MIGRATION_KEY, "true");
  return migrated;
}

function defaultBudget(name) {
  if (name === "Earnings" || name === "Budget") return 50000;
  if (name.includes("Rent") || name.includes("EMI")) return 12000;
  if (name.includes("Savings") || name.includes("Emergency")) return 5000;
  if (name.includes("Groceries")) return 6000;
  if (name.includes("Fees")) return 10000;
  return 1500;
}

function buildActuals(expenses = [], subscriptions = []) {
  const actuals = {};
  expenses.forEach((expense) => {
    const amount = Number(expense.amount || 0);
    const mainName = mapExpenseToBudgetName(expense);
    const subName = mapExpenseToBudgetSubcategory(expense);
    actuals[mainName] = (actuals[mainName] || 0) + amount;
    if (subName) actuals[subName] = (actuals[subName] || 0) + amount;
  });
  subscriptions
    .filter((item) => item.active !== false)
    .forEach((item) => {
      const amount = monthlySubscriptionAmount(item);
      actuals.Subscriptions = (actuals.Subscriptions || 0) + amount;
      actuals["Cloud / Apps"] = (actuals["Cloud / Apps"] || 0) + amount;
    });
  return actuals;
}

function monthlySubscriptionAmount(item) {
  const intervalMonths = Math.max(1, Number(item.intervalMonths || item.billingCycle || 1));
  return Number(item.amount || 0) / intervalMonths;
}

function mapExpenseToBudgetName(expense) {
  const text = `${expense.category || ""} ${expense.note || ""}`.toLowerCase();
  if (/rent|house emi|maintenance/.test(text)) return "Rent / Housing";
  if (/electric|water|gas|lpg|internet|wi-fi|wifi|mobile|recharge|dth|cable|bill|utility/.test(text)) return "Bills & Utilities";
  if (/grocery|groceries|vegetable|fruit|milk|dairy|food|zomato|swiggy|restaurant|eating|cafe|coffee|tea|lunch|dinner|snack/.test(text)) return "Food";
  if (/transport|metro|bus|cab|auto|rapido|uber|ola|fuel|petrol|diesel|parking|vehicle/.test(text)) return "Transport";
  if (/book|stationery|tuition|college|school|course|exam|education/.test(text)) return "Education";
  if (/medicine|medical|health|insurance|gym|fitness/.test(text)) return "Health";
  if (/clothing|footwear|personal care|salon|shopping/.test(text)) return "Shopping";
  if (/movie|event|entertainment|gift/.test(text)) return "Entertainment";
  if (/spotify|music|netflix|ott|prime|subscription|cloud|app|chatgpt|disney|youtube/.test(text)) return "Subscriptions";
  if (/saving|investment|emergency fund/.test(text)) return "Savings";
  if (/shopping/.test(text)) return "Shopping";
  if (/travel|trip/.test(text)) return "Travel";
  return simplifyBudgetCategory(expense.category || "Other");
}

function mapExpenseToBudgetSubcategory(expense) {
  const text = `${expense.category || ""} ${expense.note || ""}`.toLowerCase();
  if (/grocery|groceries/.test(text)) return "Groceries";
  if (/zomato|swiggy|food delivery/.test(text)) return "Food Delivery";
  if (/restaurant|eating|cafe|coffee|tea|lunch|dinner|snack|food/.test(text)) return "Restaurants";
  if (/fuel|petrol|diesel/.test(text)) return "Fuel";
  if (/metro|bus|transport/.test(text)) return "Public Transport";
  if (/cab|auto|rapido|uber|ola/.test(text)) return "Cab / Auto";
  if (/vehicle emi/.test(text)) return "Vehicle EMI";
  if (/parking|toll/.test(text)) return "Parking";
  if (/electric/.test(text)) return "Electricity";
  if (/water/.test(text)) return "Water";
  if (/gas|lpg/.test(text)) return "LPG / Gas";
  if (/internet|wi-fi|wifi/.test(text)) return "Internet";
  if (/mobile|recharge/.test(text)) return "Mobile Recharge";
  if (/dth|cable/.test(text)) return "DTH / Cable";
  if (/rent/.test(text)) return "Rent";
  if (/house emi|home emi/.test(text)) return "House EMI";
  if (/maintenance/.test(text)) return "Maintenance";
  if (/school|college|fees/.test(text)) return "School / College Fees";
  if (/tuition/.test(text)) return "Tuition";
  if (/book|stationery/.test(text)) return "Books";
  if (/course|online/.test(text)) return "Online Courses";
  if (/medicine/.test(text)) return "Medicines";
  if (/medical|health/.test(text)) return "Medical";
  if (/insurance/.test(text)) return "Health Insurance";
  if (/gym|fitness/.test(text)) return "Gym";
  if (/clothing/.test(text)) return "Clothing";
  if (/footwear/.test(text)) return "Footwear";
  if (/personal care|salon/.test(text)) return "Personal Care";
  if (/movie|event|entertainment/.test(text)) return "Movies / Events";
  if (/gift/.test(text)) return "Gifts";
  if (/netflix|ott|prime|disney|youtube/.test(text)) return "OTT";
  if (/spotify|music/.test(text)) return "Music";
  if (/cloud|app|chatgpt/.test(text)) return "Cloud / Apps";
  if (/investment/.test(text)) return "Investments";
  if (/emergency/.test(text)) return "Emergency Fund";
  if (/travel|trip/.test(text)) return "Trips";
  return null;
}

function simplifyBudgetCategory(name = "Other") {
  const text = String(name).toLowerCase();
  if (/grocery|vegetable|fruit|milk|dairy|food|restaurant|eating|tea|coffee|snack/.test(text)) return "Food";
  if (/fuel|transport|cab|auto|parking|vehicle/.test(text)) return "Transport";
  if (/electric|water|gas|lpg|internet|wi-fi|wifi|mobile|recharge|dth|cable|bill|utilities/.test(text)) return "Bills & Utilities";
  if (/rent|house emi|maintenance|housing/.test(text)) return "Rent / Housing";
  if (/school|college|tuition|book|stationery|course|education|exam/.test(text)) return "Education";
  if (/medical|medicine|health|insurance|gym|fitness/.test(text)) return "Health";
  if (/clothing|footwear|personal care|salon|shopping/.test(text)) return "Shopping";
  if (/entertainment|movie|event|gift/.test(text)) return "Entertainment";
  if (/ott|music|cloud|app|subscription|spotify|netflix/.test(text)) return "Subscriptions";
  if (/saving|investment|emergency/.test(text)) return "Savings";
  if (/travel|trip/.test(text)) return "Travel";
  return mainCategories.includes(name) ? name : "Other";
}

