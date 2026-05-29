import { CalendarDays, Check, ChevronLeft, ChevronRight, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import CategoryBadge from "./CategoryBadge.jsx";
import { formatCurrency } from "../services/currency.js";
import { eventStats } from "../services/events.js";
import { localDateString } from "../services/dates.js";
import { confirmSpendly } from "../services/confirmDialog.js";

const eventTypes = ["Trip", "Vacation", "Business Trip", "College Event", "Festival", "Shopping", "Birthday", "Other"];
const filters = ["All", "Active", "Upcoming", "Completed", "Over Budget"];
const eventExpenseCategories = [
  { id: 10, name: "Food" },
  { id: 1, name: "Transport" },
  { id: 11, name: "Bills & Utilities" },
  { id: 12, name: "Rent / Housing" },
  { id: 13, name: "Education" },
  { id: 2, name: "Books" },
  { id: 6, name: "Health" },
  { id: 7, name: "Shopping" },
  { id: 5, name: "Entertainment" },
  { id: 8, name: "Subscriptions" },
  { id: 14, name: "Savings" },
  { id: 15, name: "Travel" },
  { id: 9, name: "Other" }
];
const emptyEvent = {
  id: null,
  name: "",
  type: "Trip",
  startDate: localDateString(),
  endDate: localDateString(),
  budgetAmount: "",
  notes: ""
};

export default function EventsPage({ user, categories = [], expenses = [], events = [], onCreateEvent, onUpdateEvent, onDeleteEvent, onAddExpense, onDeleteExpense }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(emptyEvent);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [expenseEvent, setExpenseEvent] = useState(null);

  const decorated = useMemo(() => events.map((event) => ({ ...event, stats: eventStats(event, expenses) })), [events, expenses]);
  const filtered = decorated
    .filter((event) => filter === "All" || event.stats.status === filter)
    .filter((event) => !search || `${event.name} ${event.type}`.toLowerCase().includes(search.toLowerCase()));
  const selectedEvent = decorated.find((event) => String(event.id) === String(selectedEventId)) || filtered[0] || null;

  function openCreate() {
    setEditingEvent({ ...emptyEvent, id: null });
    setModalOpen(true);
  }

  function openEdit(event) {
    setEditingEvent({ ...event, budgetAmount: String(event.budgetAmount || "") });
    setModalOpen(true);
  }

  async function completeEvent(event) {
    if (event.completed || event.stats.status === "Completed") return;
    const confirmed = await confirmSpendly({
      title: `Complete ${event.name}?`,
      message: "You can finish this event before its end date. Existing event expenses will stay connected.",
      confirmLabel: "Complete event"
    });
    if (!confirmed) return;
    await onUpdateEvent(event.id, { ...event, completed: true });
  }

  async function saveEvent(event) {
    const payload = {
      ...event,
      userId: user?.id || "local",
      budgetAmount: Number(event.budgetAmount || 0)
    };
    const row = event.id ? await onUpdateEvent(event.id, payload) : await onCreateEvent(payload);
    if (row?.id) setSelectedEventId(row.id);
    setModalOpen(false);
  }

  async function deleteEvent(event) {
    const linkedIds = expenses.filter((expense) => String(expense.eventId) === String(event.id)).map((expense) => expense.id);
    const deleteLinked = linkedIds.length > 0 && await confirmSpendly({
      title: "Delete linked expenses too?",
      message: `${event.name} has ${linkedIds.length} linked expense${linkedIds.length === 1 ? "" : "s"}. Confirm deletes them too, while Cancel keeps them as normal transactions.`,
      confirmLabel: "Delete linked",
      cancelLabel: "Keep expenses",
      tone: "danger"
    });
    const confirmed = await confirmSpendly({
      title: `Delete ${event.name}?`,
      message: deleteLinked ? "This will delete the event and its linked expenses." : "This will delete only the event and keep linked expenses as normal transactions.",
      confirmLabel: "Delete event",
      tone: "danger"
    });
    if (!confirmed) return;
    if (deleteLinked && !onDeleteEvent) await Promise.all(linkedIds.map((id) => onDeleteExpense(id)));
    if (onDeleteEvent) await onDeleteEvent(event.id, { deleteLinkedExpenses: deleteLinked });
    if (selectedEventId === event.id) setSelectedEventId(null);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-end">
        <button className="btn-primary px-4 py-3" onClick={openCreate}><Plus size={18} /> Create Event</button>
      </div>

      <div className="card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
            <input className="input pl-10" placeholder="Search events..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="flex gap-2 overflow-x-auto">
            {filters.map((item) => (
              <button key={item} className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-bold transition ${filter === item ? "bg-violet-500 text-white" : "bg-white/8 text-slate-300 hover:bg-violet-500/15"}`} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <section className="card grid min-h-72 place-items-center p-8 text-center">
          <div>
            <h3 className="text-2xl font-black">No events yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Create an event to track spending for trips, vacations, or special plans.</p>
            <button className="btn-primary mt-5" onClick={openCreate}><Plus size={17} /> Create Event</button>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                selected={String(selectedEvent?.id) === String(event.id)}
                onSelect={() => setSelectedEventId(event.id)}
                onComplete={() => completeEvent(event)}
                onAddExpense={() => setExpenseEvent(event)}
                onEdit={() => openEdit(event)}
                onDelete={() => deleteEvent(event)}
              />
            ))}
          </div>
          {selectedEvent && <EventDetail event={selectedEvent} onAddExpense={() => setExpenseEvent(selectedEvent)} />}
        </div>
      )}

      {modalOpen && <EventModal event={editingEvent} onClose={() => setModalOpen(false)} onSave={saveEvent} />}
      {expenseEvent && (
        <EventExpenseModal
          event={expenseEvent}
          categories={categories}
          onClose={() => setExpenseEvent(null)}
          onSave={async (payload) => {
            await onAddExpense(payload, expenseEvent);
            setExpenseEvent(null);
          }}
        />
      )}
    </section>
  );
}

function EventCard({ event, selected, onComplete, onAddExpense, onEdit, onDelete }) {
  const { stats } = event;
  const completeDisabled = event.completed || stats.status === "Completed";
  return (
    <article className={`card flex min-h-[22rem] flex-col p-5 transition ${selected ? "border-violet-300/40 shadow-[0_22px_55px_rgba(139,92,246,0.14)]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="w-fit rounded-full bg-violet-500/15 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wide text-violet-200">{event.type}</p>
          <h3 className="mt-3 truncate text-2xl font-black text-white">{event.name}</h3>
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} /> {event.startDate} to {event.endDate}</p>
        </div>
        <StatusBadge status={stats.status} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
        <Metric label="Budget" value={formatCurrency(event.budgetAmount)} />
        <Metric label="Spent" value={formatCurrency(stats.totalSpent)} />
        <Metric label="Left" value={formatCurrency(stats.remaining)} tone={stats.remaining >= 0 ? "text-emerald-300" : "text-amber-300"} />
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-slate-400">Budget used</span>
          <span className="font-black text-violet-100">{stats.usedPercentage}%</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-cyan-300 shadow-[0_0_22px_rgba(139,92,246,0.38)]" style={{ width: `${stats.usedPercentage}%` }} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-violet-500/10 p-3">
          <p className="text-[11px] font-semibold text-slate-400">Safe to spend</p>
          <p className="mt-1 text-sm font-black text-violet-100">{formatCurrency(stats.dailySafeSpend)}/day</p>
        </div>
        <div className="rounded-3xl bg-white/[0.04] p-3">
          <p className="text-[11px] font-semibold text-slate-400">Linked expenses</p>
          <p className="mt-1 text-sm font-black text-white">{stats.expenses.length}</p>
        </div>
      </div>

      {event.notes && <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-400">{event.notes}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <button
          className={`btn-soft flex-1 justify-center px-3 py-2 text-xs ${completeDisabled ? "cursor-default opacity-70" : ""}`}
          onClick={completeDisabled ? undefined : onComplete}
          disabled={completeDisabled}
        >
          {completeDisabled ? "Completed" : "Complete event"}
        </button>
        <button className="btn-primary flex-1 justify-center px-3 py-2 text-xs" onClick={onAddExpense}><Plus size={14} /> Add expense</button>
        <button className="btn-soft px-3 py-2 text-xs" onClick={onEdit} aria-label={`Edit ${event.name}`}><Edit3 size={14} /></button>
        <button className="btn-danger px-3 py-2 text-xs" onClick={onDelete} aria-label={`Delete ${event.name}`}><Trash2 size={14} /></button>
      </div>
    </article>
  );
}

function EventDetail({ event, onAddExpense }) {
  const byCategory = Object.values(event.stats.expenses.reduce((acc, expense) => {
    const category = expense.category || "Other";
    if (!acc[category]) acc[category] = { category, amount: 0 };
    acc[category].amount += Number(expense.amount || 0);
    return acc;
  }, {})).sort((a, b) => b.amount - a.amount);
  return (
    <aside className="card p-5 xl:sticky xl:top-6 xl:self-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-violet-200">Event overview</p>
          <h3 className="mt-1 text-2xl font-black text-white">{event.name}</h3>
        </div>
        <button className="btn-primary px-3 py-2 text-xs" onClick={onAddExpense}><Plus size={14} /> Add expense</button>
      </div>
      <p className="mt-4 rounded-3xl bg-violet-500/10 p-4 text-sm leading-6 text-violet-100">
        You can spend {formatCurrency(event.stats.dailySafeSpend)}/day for the next {event.stats.remainingDays} day{event.stats.remainingDays === 1 ? "" : "s"} of this event.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Budget" value={formatCurrency(event.budgetAmount)} />
        <Metric label="Spent" value={formatCurrency(event.stats.totalSpent)} />
        <Metric label="Remaining" value={formatCurrency(event.stats.remaining)} />
        <Metric label="Used" value={`${event.stats.usedPercentage}%`} />
      </div>
      <div className="mt-5">
        <h4 className="text-sm font-black text-white">Category breakdown</h4>
        <div className="mt-3 space-y-2">
          {byCategory.length === 0 ? <p className="text-sm text-slate-400">No event expenses yet.</p> : byCategory.map((row) => (
            <div key={row.category} className="flex items-center justify-between rounded-2xl bg-white/8 p-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-200"><CategoryBadge category={row.category} size={26} iconSize={13} />{row.category}</span>
              <span className="text-sm font-black">{formatCurrency(row.amount)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5">
        <h4 className="text-sm font-black text-white">Expense list</h4>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {event.stats.expenses.length === 0 ? <p className="text-sm text-slate-400">No linked transactions.</p> : event.stats.expenses.map((expense) => (
            <div key={expense.id} className="rounded-2xl bg-white/8 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-100">{expense.note || expense.category}</p>
                  <p className="text-xs text-slate-500">{expense.date} · {expense.category}</p>
                </div>
                <p className="font-black">{formatCurrency(expense.amount)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function EventModal({ event, onClose, onSave }) {
  const [form, setForm] = useState(event);
  const invalid = !form.name.trim() || !form.startDate || !form.endDate || Number(form.budgetAmount || 0) <= 0 || form.endDate < form.startDate;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 px-4 backdrop-blur-sm">
      <section className="card w-full max-w-2xl p-5 md:p-6" style={{ overflow: "visible" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black text-white">{form.id ? "Edit Event" : "Create Event"}</h3>
            <p className="mt-1 text-sm text-slate-400">Set a short-term budget for a trip, festival, or plan.</p>
          </div>
          <button className="btn-soft px-3" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-300">Event name<input className="input mt-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="block text-sm font-semibold text-slate-300">Event type<select className="input mt-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{eventTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <PurpleDateField label="Start date" value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} />
          <PurpleDateField label="End date" value={form.endDate} onChange={(value) => setForm({ ...form, endDate: value })} />
          <label className="block text-sm font-semibold text-slate-300 sm:col-span-2">Total budget<input className="input mt-2" type="number" min="1" value={form.budgetAmount} onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })} /></label>
          <label className="block text-sm font-semibold text-slate-300 sm:col-span-2">Notes<textarea className="input mt-2 min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </div>
        {form.endDate < form.startDate && <p className="mt-3 text-sm font-semibold text-amber-300">End date cannot be before start date.</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn-soft" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={invalid} onClick={() => onSave(form)}><Check size={17} /> {form.id ? "Save Event" : "Create Event"}</button>
        </div>
      </section>
    </div>
  );
}

function PurpleDateField({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const date = parseDate(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const selected = parseDate(value);
  const today = new Date();
  const days = buildDatePickerDays(viewMonth);

  function selectDate(date) {
    onChange(toIsoDate(date));
    setOpen(false);
  }

  return (
    <div className="relative">
      <p className="text-sm font-semibold text-slate-300">{label}</p>
      <button
        type="button"
        className="input mt-2 flex items-center justify-between text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{formatDateInput(value)}</span>
        <CalendarDays size={17} className="text-violet-200" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[120] mt-2 w-full min-w-[18rem] rounded-[22px] border border-violet-300/25 bg-slate-950/95 p-3 shadow-[0_24px_70px_rgba(76,29,149,0.45)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <button className="rounded-full bg-white/8 p-2 text-slate-200 transition hover:bg-violet-500/20" type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-black text-white">{viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
            <button className="rounded-full bg-white/8 p-2 text-slate-200 transition hover:bg-violet-500/20" type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-violet-200">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const isSelected = sameDay(day.date, selected);
              const isToday = sameDay(day.date, today);
              return (
                <button
                  key={day.iso}
                  type="button"
                  className={`grid h-9 place-items-center rounded-xl text-xs font-bold transition ${
                    isSelected
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_10px_24px_rgba(139,92,246,0.35)]"
                      : day.inMonth
                        ? "text-slate-100 hover:bg-violet-500/20"
                        : "text-slate-600 hover:bg-white/5"
                  } ${isToday && !isSelected ? "ring-1 ring-violet-300/60" : ""}`}
                  onClick={() => selectDate(day.date)}
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" className="rounded-xl px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-white/8 hover:text-slate-100" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="rounded-xl bg-violet-500/20 px-3 py-2 text-xs font-bold text-violet-100 transition hover:bg-violet-500/30" onClick={() => selectDate(today)}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

function EventExpenseModal({ event, categories, onClose, onSave }) {
  const categoryRows = mergeEventExpenseCategories(categories);
  const [form, setForm] = useState({
    amount: "",
    categoryId: categoryRows[0]?.id || "",
    paymentMethod: "upi",
    date: localDateString(),
    note: ""
  });
  const invalid = Number(form.amount || 0) <= 0 || !form.categoryId || !form.date;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/65 px-4 backdrop-blur-sm">
      <section className="card w-full max-w-xl p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black text-white">Add event expense</h3>
            <p className="mt-1 text-sm text-slate-400">This transaction will also update Spending and Budget.</p>
          </div>
          <button className="btn-soft px-3" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-300">Amount<input className="input mt-2" type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label className="block text-sm font-semibold text-slate-300">Category<select className="input mt-2" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categoryRows.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="block text-sm font-semibold text-slate-300">Payment method<select className="input mt-2" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>{["upi", "card", "cash", "bank", "other"].map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
          <label className="block text-sm font-semibold text-slate-300">Date<input className="input mt-2" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label className="block text-sm font-semibold text-slate-300 sm:col-span-2">Note<input className="input mt-2" value={form.note} placeholder={`${event.name} expense`} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn-soft" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={invalid} onClick={() => onSave(form)}><Plus size={17} /> Add expense</button>
        </div>
      </section>
    </div>
  );
}

function mergeEventExpenseCategories(categories = []) {
  const rows = [...eventExpenseCategories];
  const names = new Set(rows.map((item) => item.name.toLowerCase()));
  categories.forEach((category) => {
    if (!category?.name || names.has(category.name.toLowerCase())) return;
    rows.push(category);
    names.add(category.name.toLowerCase());
  });
  return rows;
}

function parseDate(value) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateInput(value) {
  return parseDate(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function sameDay(a, b) {
  return toIsoDate(a) === toIsoDate(b);
}

function buildDatePickerDays(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      iso: toIsoDate(date),
      inMonth: date.getMonth() === monthDate.getMonth()
    };
  });
}

function Metric({ label, value, tone = "text-slate-100" }) {
  return (
    <div className="rounded-2xl bg-white/8 p-3">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-black tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const tone = status === "Active" ? "bg-emerald-500/15 text-emerald-200" : status === "Over Budget" ? "bg-rose-500/15 text-rose-200" : status === "Upcoming" ? "bg-violet-500/15 text-violet-200" : "bg-white/10 text-slate-300";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${tone}`}>{status}</span>;
}
