import { CalendarDays, Check, ChevronDown, CreditCard, Edit3, MoreVertical, Plus, Search, Sparkles, Trash2, WalletCards, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency } from "../services/currency.js";
import { confirmSpendly } from "../services/confirmDialog.js";

const categoryOptions = ["Entertainment", "Study", "Utility", "Bills", "Other"];
const intervalOptions = [
  { label: "Monthly", value: 1 },
  { label: "Quarterly", value: 3 },
  { label: "Half-yearly", value: 6 },
  { label: "Yearly", value: 12 }
];
const paymentMethods = ["card", "upi", "cash", "bank", "other"];

const popularSubscriptionPlans = [
  { name: "Netflix", amount: 649, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "Spotify Premium", amount: 119, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "YouTube Premium", amount: 129, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "Amazon Prime", amount: 1499, categoryName: "Entertainment", intervalMonths: 12 },
  { name: "Disney+", amount: 299, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "Hulu", amount: 699, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "HBO Max", amount: 1299, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "Apple TV+", amount: 99, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "Peacock Premium", amount: 499, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "Paramount+", amount: 499, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "Crunchyroll", amount: 99, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "SonyLIV", amount: 999, categoryName: "Entertainment", intervalMonths: 12 },
  { name: "JioHotstar", amount: 299, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "ZEE5", amount: 899, categoryName: "Entertainment", intervalMonths: 12 },
  { name: "Audible", amount: 199, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "Apple Music", amount: 99, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "Amazon Music Unlimited", amount: 99, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "Tidal", amount: 999, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "SoundCloud Go+", amount: 999, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "SiriusXM", amount: 1099, categoryName: "Entertainment", intervalMonths: 1 },
  { name: "Google One", amount: 130, categoryName: "Utility", intervalMonths: 1 },
  { name: "iCloud+", amount: 75, categoryName: "Utility", intervalMonths: 1 },
  { name: "Microsoft 365", amount: 489, categoryName: "Utility", intervalMonths: 1 },
  { name: "Dropbox", amount: 999, categoryName: "Utility", intervalMonths: 1 },
  { name: "Adobe Creative Cloud", amount: 1675, categoryName: "Utility", intervalMonths: 1 },
  { name: "Canva Pro", amount: 500, categoryName: "Utility", intervalMonths: 1 },
  { name: "Notion Plus", amount: 799, categoryName: "Utility", intervalMonths: 1 },
  { name: "Todoist Pro", amount: 399, categoryName: "Utility", intervalMonths: 1 },
  { name: "Evernote", amount: 449, categoryName: "Utility", intervalMonths: 1 },
  { name: "1Password", amount: 299, categoryName: "Utility", intervalMonths: 1 },
  { name: "NordVPN", amount: 299, categoryName: "Utility", intervalMonths: 1 },
  { name: "ExpressVPN", amount: 1049, categoryName: "Utility", intervalMonths: 1 },
  { name: "Grammarly Premium", amount: 999, categoryName: "Study", intervalMonths: 1 },
  { name: "Duolingo Super", amount: 750, categoryName: "Study", intervalMonths: 1 },
  { name: "Coursera Plus", amount: 4999, categoryName: "Study", intervalMonths: 1 },
  { name: "Skillshare", amount: 1200, categoryName: "Study", intervalMonths: 1 },
  { name: "LinkedIn Premium", amount: 1400, categoryName: "Study", intervalMonths: 1 },
  { name: "GitHub Copilot", amount: 899, categoryName: "Study", intervalMonths: 1 },
  { name: "ChatGPT Plus", amount: 1999, categoryName: "Study", intervalMonths: 1 },
  { name: "Perplexity Pro", amount: 1999, categoryName: "Study", intervalMonths: 1 },
  { name: "Medium", amount: 499, categoryName: "Study", intervalMonths: 1 },
  { name: "The New York Times", amount: 799, categoryName: "Study", intervalMonths: 1 },
  { name: "Kindle Unlimited", amount: 169, categoryName: "Study", intervalMonths: 1 },
  { name: "Headspace", amount: 799, categoryName: "Other", intervalMonths: 1 },
  { name: "Calm", amount: 999, categoryName: "Other", intervalMonths: 1 },
  { name: "Strava", amount: 549, categoryName: "Other", intervalMonths: 1 },
  { name: "MyFitnessPal", amount: 799, categoryName: "Other", intervalMonths: 1 },
  { name: "Peloton", amount: 1099, categoryName: "Other", intervalMonths: 1 },
  { name: "Uber One", amount: 499, categoryName: "Other", intervalMonths: 1 },
  { name: "Walmart+", amount: 1099, categoryName: "Other", intervalMonths: 1 }
];

const emptyForm = {
  id: null,
  name: "",
  amount: "",
  intervalMonths: 1,
  categoryName: "Entertainment",
  paymentMethod: "card",
  nextDueDate: new Date().toISOString().slice(0, 10),
  notes: "",
  reminder: true,
  active: true
};

export default function SubscriptionManagerPage({ categories, subscriptions, onCreate, onUpdate, onDelete }) {
  const [search, setSearch] = useState("");
  const [cycleFilter, setCycleFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("due");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const normalized = useMemo(() => subscriptions.map((item) => normalizeSubscription(item)), [subscriptions]);
  const filtered = useMemo(() => filterSubscriptions(normalized, { search, cycleFilter, categoryFilter, sortBy }), [normalized, search, cycleFilter, categoryFilter, sortBy]);
  const dueThisWeek = normalized.filter((item) => item.daysUntilDue >= 0 && item.daysUntilDue <= 7);
  const monthlyTotal = normalized.filter((item) => item.active).reduce((sum, item) => sum + monthlyEquivalent(item), 0);
  const highest = [...normalized].sort((a, b) => b.amount - a.amount)[0];

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(item) {
    setForm({
      id: item.id,
      name: item.name,
      amount: item.amount,
      intervalMonths: item.intervalMonths,
      categoryName: classifyCategory(item),
      paymentMethod: item.paymentMethod,
      nextDueDate: item.nextDueDate,
      notes: item.notes || "",
      reminder: true,
      active: item.active
    });
    setModalOpen(true);
  }

  async function saveSubscription(event) {
    event.preventDefault();
    const category = categoryForForm(categories, form.categoryName);
    const billingDay = Math.min(28, Math.max(1, Number(form.nextDueDate.slice(-2)) || 1));
    const payload = {
      name: form.name,
      amount: Number(form.amount),
      categoryId: category.id,
      billingDay,
      intervalMonths: Number(form.intervalMonths),
      paymentMethod: form.paymentMethod,
      active: form.active
    };
    if (form.id) await onUpdate(form.id, payload);
    else await onCreate(payload);
    setModalOpen(false);
  }

  async function confirmDelete(item) {
    const confirmed = await confirmSpendly({
      title: `Delete ${item.name}?`,
      message: "This recurring payment will be removed from your tracker.",
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (confirmed) await onDelete(item.id);
  }

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary px-4 py-3" onClick={openCreate}>
          <Plus size={18} />
          Add Subscription
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Monthly recurring" value={formatCurrency(monthlyTotal)} icon={WalletCards} />
        <StatTile label="Active" value={normalized.filter((item) => item.active).length} icon={CreditCard} />
        <StatTile label="Due this week" value={dueThisWeek.length} icon={CalendarDays} />
        <StatTile label="Highest" value={highest ? `${highest.name} ${formatCurrency(highest.amount)}` : "None"} icon={MoreVertical} />
      </div>

      <div className="card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px_170px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
            <input className="input pl-10" placeholder="Search subscriptions..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <select className="input" value={cycleFilter} onChange={(event) => setCycleFilter(event.target.value)}>
            <option value="all">All cycles</option>
            <option value="1">Monthly</option>
            <option value="12">Yearly</option>
            <option value="weekly">Weekly</option>
          </select>
          <select className="input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="due">Due date</option>
            <option value="amount">Amount</option>
            <option value="name">Name</option>
          </select>
          <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
      </div>

      {normalized.length === 0 ? (
        <EmptySubscriptions onAdd={openCreate} />
      ) : (
        <SubscriptionTable subscriptions={filtered} onEdit={openEdit} onDelete={confirmDelete} />
      )}

      {modalOpen && (
        <SubscriptionModal
          form={form}
          setForm={setForm}
          onClose={() => setModalOpen(false)}
          onSave={saveSubscription}
        />
      )}
    </section>
  );
}

function StatTile({ label, value, icon: Icon }) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-400">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Icon size={16} /></span>
      </div>
      <p className="mt-2 truncate text-xl font-black tracking-normal text-white">{value}</p>
    </div>
  );
}

function SubscriptionTable({ subscriptions, onEdit, onDelete }) {
  return (
    <div className="card overflow-hidden">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Payment method</th>
              <th className="px-5 py-4">Payment cycle</th>
              <th className="px-5 py-4">Due</th>
              <th className="px-5 py-4">Amount</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {subscriptions.map((item, index) => (
              <tr key={item.id}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl text-sm font-black text-white" style={{ backgroundColor: categoryColor(index) }}>{item.name[0]?.toUpperCase()}</span>
                    <div>
                      <p className="font-bold text-slate-100">{item.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-300">{classifyCategory(item)}</td>
                <td className="px-5 py-4 capitalize text-slate-300">{item.paymentMethod}</td>
                <td className="px-5 py-4 text-slate-300">{frequencyLabel(item.intervalMonths)}</td>
                <td className="px-5 py-4"><DueBadge item={item} /></td>
                <td className="px-5 py-4 font-black tabular-nums text-slate-100">{formatCurrency(item.amount)}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button className="btn-soft px-3" onClick={() => onEdit(item)}><Edit3 size={15} /></button>
                    <button className="btn-danger px-3" onClick={() => onDelete(item)} disabled={item.readOnly}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-3 lg:hidden">
        {subscriptions.map((item, index) => (
          <div key={item.id} className="rounded-3xl border border-white/10 bg-white/8 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl text-sm font-black text-white" style={{ backgroundColor: categoryColor(index) }}>{item.name[0]?.toUpperCase()}</span>
                <div>
                  <p className="font-bold text-slate-100">{item.name}</p>
                  <p className="text-xs text-slate-500">{classifyCategory(item)} / {item.paymentMethod}</p>
                </div>
              </div>
              <p className="font-black">{formatCurrency(item.amount)}</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-500/15 px-2 py-1 text-xs font-bold text-violet-100">{frequencyLabel(item.intervalMonths)}</span>
                <DueBadge item={item} />
              </div>
              <div className="flex gap-2">
                <button className="btn-soft px-3" onClick={() => onEdit(item)}><Edit3 size={15} /></button>
                <button className="btn-danger px-3" onClick={() => onDelete(item)} disabled={item.readOnly}><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpcomingSubscriptions({ subscriptions, total }) {
  const days = nextSevenDays();
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Upcoming payments</h3>
            <p className="mt-1 text-sm text-slate-400">Total due this week: {formatCurrency(total)}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-2">
          {days.map((day) => (
            <div key={day.iso} className="min-h-32 rounded-3xl border border-white/10 bg-white/5 p-2 text-center">
              <p className="text-[0.65rem] font-semibold text-slate-500">{day.label}</p>
              <p className="mt-1 text-sm font-black text-slate-100">{day.dayNumber}</p>
              <div className="mt-3 space-y-1">
                {subscriptions.filter((item) => item.dueDate === day.iso).map((item) => (
                  <div key={item.id} className="rounded-2xl bg-violet-500/15 px-1 py-1 text-[0.65rem] font-semibold text-violet-100">{item.name}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="card p-5">
        <h3 className="text-lg font-bold">Due soon</h3>
        <div className="mt-4 space-y-3">
          {subscriptions.length === 0 ? <p className="text-sm text-slate-400">No subscriptions due in the next 7 days.</p> : subscriptions.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/10 bg-white/8 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-100">{item.name}</p>
                  <DueBadge item={item} />
                </div>
                <p className="font-black">{formatCurrency(item.amount)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SubscriptionCalendar({ subscriptions, selectedDate, setSelectedDate }) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const offset = monthStart.getDay();
  const cells = [
    ...Array.from({ length: offset }, (_, index) => ({ empty: true, key: `empty-${index}` })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { day, iso, items: subscriptions.filter((item) => item.dueDate === iso) };
    })
  ];
  const selected = subscriptions.filter((item) => item.dueDate === selectedDate);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <section className="card p-5">
        <h3 className="text-lg font-bold">{today.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3>
        <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((cell) => cell.empty ? <div key={cell.key} /> : (
            <button key={cell.iso} className={`min-h-20 rounded-3xl border p-2 text-left ${selectedDate === cell.iso ? "border-violet-300 bg-violet-500/15" : "border-white/10 bg-white/5"}`} onClick={() => setSelectedDate(cell.iso)}>
              <span className="text-sm font-bold">{cell.day}</span>
              <div className="mt-2 space-y-1">
                {cell.items.slice(0, 2).map((item) => <div key={item.id} className="h-1.5 rounded-full bg-violet-300" />)}
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="card p-5">
        <h3 className="text-lg font-bold">Due on {selectedDate}</h3>
        <div className="mt-4 space-y-3">
          {selected.length === 0 ? <p className="text-sm text-slate-400">No subscriptions due on this date.</p> : selected.map((item) => (
            <div key={item.id} className="rounded-3xl bg-white/8 p-3">
              <p className="font-bold">{item.name}</p>
              <p className="text-sm text-slate-400">{formatCurrency(item.amount)} / {frequencyLabel(item.intervalMonths)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SubscriptionModal({ form, setForm, onClose, onSave }) {
  const [planSearch, setPlanSearch] = useState("");
  const [customOpen, setCustomOpen] = useState(Boolean(form.id));
  const filteredPlans = popularSubscriptionPlans.filter((plan) =>
    `${plan.name} ${plan.categoryName} ${frequencyLabel(plan.intervalMonths)}`.toLowerCase().includes(planSearch.toLowerCase())
  );
  const canSave = Boolean(String(form.name || "").trim()) && Number(form.amount || 0) > 0 && Boolean(form.nextDueDate);

  function applyPopularPlan(plan) {
    setForm({
      ...form,
      name: plan.name,
      amount: String(plan.amount),
      intervalMonths: plan.intervalMonths,
      categoryName: plan.categoryName,
      notes: form.notes || `Started from Spendly's popular subscription catalog. Amount is an editable estimate.`
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
      <form className="card max-h-[92vh] w-full max-w-5xl overflow-y-auto p-0" onSubmit={onSave}>
        <div className="p-5 pb-0 md:p-6 md:pb-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black">{form.id ? "Edit subscription" : "Add subscription"}</h3>
            <p className="mt-1 text-sm text-slate-400">Track recurring payments in your Spendly dashboard.</p>
          </div>
          <button className="btn-soft px-3" type="button" onClick={onClose}><X size={17} /></button>
        </div>

        {!form.id && (
          <section className="mt-5 rounded-3xl border border-violet-400/20 bg-violet-500/10 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-violet-200">
                  <Sparkles size={16} />
                  Popular plans
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">Choose from 50 famous subscriptions. Prices are editable INR estimates.</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                <label className="relative w-full md:w-80">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    className="input pl-12"
                    placeholder=""
                    value={planSearch}
                    onChange={(event) => setPlanSearch(event.target.value)}
                  />
                </label>
              </div>
            </div>
            <div className="mt-4 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPlans.map((plan) => {
                const selected = form.name === plan.name;
                return (
                  <button
                    key={plan.name}
                    className={`group flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${
                      selected
                        ? "border-violet-300 bg-violet-500/25 text-white"
                        : "border-white/10 bg-white/8 text-slate-200 hover:border-violet-300/40 hover:bg-violet-500/15"
                    }`}
                    type="button"
                    onClick={() => applyPopularPlan(plan)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{plan.name}</span>
                      <span className="mt-1 block text-xs text-slate-400">{plan.categoryName} / {frequencyLabel(plan.intervalMonths)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-black tabular-nums text-violet-100">{formatCurrency(plan.amount)}</span>
                      {selected && <Check size={16} className="text-emerald-300" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          <button
            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-violet-500/10"
            type="button"
            onClick={() => setCustomOpen((open) => !open)}
            aria-expanded={customOpen}
          >
            <span>
              <span className="block text-sm font-black text-white">Add Custom Subscription</span>
              <span className="mt-1 block text-xs text-slate-400">Create your own recurring payment or edit the selected plan details.</span>
            </span>
            <ChevronDown className={`shrink-0 text-violet-200 transition-transform duration-300 ${customOpen ? "rotate-180" : ""}`} size={20} />
          </button>
          <div className={`grid transition-all duration-300 ease-out ${customOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden">
              <div className="grid gap-4 border-t border-white/10 p-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-300">Subscription name<input className="input mt-2" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="block text-sm font-semibold text-slate-300">Amount<input className="input mt-2" type="number" min="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
                <label className="block text-sm font-semibold text-slate-300">Billing cycle<select className="input mt-2" value={form.intervalMonths} onChange={(e) => setForm({ ...form, intervalMonths: Number(e.target.value) })}>{intervalOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="block text-sm font-semibold text-slate-300">Category<select className="input mt-2" value={form.categoryName} onChange={(e) => setForm({ ...form, categoryName: e.target.value })}>{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="block text-sm font-semibold text-slate-300">Payment method<select className="input mt-2" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>{paymentMethods.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
                <label className="block text-sm font-semibold text-slate-300">Next due date<input className="input mt-2" type="date" required value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} /></label>
                <label className="block text-sm font-semibold text-slate-300 sm:col-span-2">Notes<textarea className="input mt-2 min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                <label className="flex items-center gap-3 rounded-3xl bg-white/8 px-4 py-3 text-sm font-semibold text-slate-300 sm:col-span-2"><input type="checkbox" checked={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.checked })} /> Reminder enabled</label>
              </div>
            </div>
          </div>
        </section>
        </div>
        <div className="sticky bottom-0 mt-6 flex flex-col-reverse gap-3 border-t border-white/10 bg-slate-950/95 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between md:px-6">
          <p className="text-xs text-slate-400">
            {canSave ? "Ready to add this recurring payment to your dashboard." : "Choose a plan or enter a name, amount, and due date."}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn-soft" type="button" onClick={onClose}>Cancel</button>
          <button className="btn-primary" type="submit" disabled={!canSave}>
            <Plus size={17} />
            {form.id ? "Save subscription" : "Add subscription"}
          </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function EmptySubscriptions({ onAdd }) {
  return (
    <section className="card grid min-h-72 place-items-center p-8 text-center">
      <div>
        <h3 className="text-2xl font-black">No subscriptions yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Add your first recurring payment to start tracking automatic expenses.</p>
        <button className="btn-primary mt-5" onClick={onAdd}><Plus size={17} /> Add Subscription</button>
      </div>
    </section>
  );
}

function DueBadge({ item }) {
  const text = dueText(item.daysUntilDue);
  const tone = item.daysUntilDue < 0 ? "bg-rose-500/15 text-rose-200" : item.daysUntilDue === 0 ? "bg-amber-500/15 text-amber-200" : "bg-violet-500/15 text-violet-200";
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{text}</span>;
}

function normalizeSubscription(item) {
  const dueDate = nextDueDateFromDay(item.billingDay);
  return { ...item, dueDate, nextDueDate: dueDate, daysUntilDue: diffDays(dueDate), intervalMonths: Number(item.intervalMonths || item.billingCycle || 1) };
}

function filterSubscriptions(items, { search, cycleFilter, categoryFilter, sortBy }) {
  return items
    .filter((item) => !search || item.name.toLowerCase().includes(search.toLowerCase()))
    .filter((item) => cycleFilter === "all" || (cycleFilter === "weekly" ? false : String(item.intervalMonths) === cycleFilter))
    .filter((item) => categoryFilter === "all" || classifyCategory(item) === categoryFilter)
    .sort((a, b) => sortBy === "amount" ? b.amount - a.amount : sortBy === "name" ? a.name.localeCompare(b.name) : a.daysUntilDue - b.daysUntilDue);
}

function nextDueDateFromDay(day) {
  const date = new Date();
  const target = Math.min(28, Number(day) || 1);
  date.setDate(target);
  if (date < new Date(new Date().toDateString())) date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function diffDays(iso) {
  const today = new Date(new Date().toDateString());
  const due = new Date(`${iso}T00:00:00`);
  return Math.round((due - today) / 86400000);
}

function dueText(days) {
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

function frequencyLabel(intervalMonths) {
  if (Number(intervalMonths) === 12) return "Yearly";
  if (Number(intervalMonths) === 6) return "Half-yearly";
  if (Number(intervalMonths) === 3) return "Quarterly";
  return "Monthly";
}

function monthlyEquivalent(item) {
  return Number(item.amount || 0) / Number(item.intervalMonths || 1);
}

function classifyCategory(item) {
  const text = `${item.name} ${item.category || ""}`.toLowerCase();
  if (/netflix|spotify|prime|hotstar|entertain/.test(text)) return "Entertainment";
  if (/course|study|tuition|coursera|book|school/.test(text)) return "Study";
  if (/cloud|google|utility|storage|phone|internet/.test(text)) return "Utility";
  if (/rent|bill|electric|water|fees/.test(text)) return "Bills";
  return "Other";
}

function categoryForForm(categories, categoryName) {
  const fallback = categories.find((item) => item.name === "Subscriptions") || categories[0] || { id: 8 };
  const map = {
    Entertainment: "Entertainment",
    Study: "Tuition",
    Utility: "Subscriptions",
    Bills: "Rent",
    Other: "Other"
  };
  return categories.find((item) => item.name === map[categoryName]) || fallback;
}

function categoryColor(index) {
  return ["#8b5cf6", "#6366f1", "#a78bfa", "#7c3aed", "#c084fc", "#22c55e"][index % 6];
}

function nextSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return { iso: date.toISOString().slice(0, 10), dayNumber: date.getDate(), label: index === 0 ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short" }) };
  });
}
