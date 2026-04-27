import { Repeat, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatCurrency } from "../services/currency.js";
import { inferCategoryFromNote } from "../services/categoryInference.js";

const defaultForm = {
  name: "",
  amount: "",
  categoryId: "",
  billingDay: 1,
  intervalMonths: 1,
  paymentMethod: "card",
  active: true
};

export default function SubscriptionsPanel({ categories, subscriptions, onCreate, onDelete }) {
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    setForm((current) => ({ ...current, categoryId: current.categoryId || categories.find((item) => item.name === "Subscriptions")?.id || categories[0]?.id || "" }));
  }, [categories]);

  function updateName(value) {
    const inferred = inferCategoryFromNote(value, categories);
    setForm((current) => ({
      ...current,
      name: value,
      categoryId: inferred?.id || current.categoryId
    }));
  }

  async function submit(event) {
    event.preventDefault();
    await onCreate({ ...form, amount: Number(form.amount), categoryId: Number(form.categoryId), billingDay: Number(form.billingDay), intervalMonths: Number(form.intervalMonths) });
    setForm({ ...defaultForm, categoryId: categories.find((item) => item.name === "Subscriptions")?.id || categories[0]?.id || "" });
  }

  return (
    <section className="card p-4">
      <div className="flex items-center gap-2">
        <Repeat className="text-violet-300" size={20} />
        <h2 className="text-lg font-bold tracking-normal">Subscriptions</h2>
      </div>
      <form className="mt-4 grid gap-2" onSubmit={submit}>
        <input
          className="input"
          value={form.name}
          onChange={(event) => updateName(event.target.value)}
          placeholder="Spotify, Netflix, study app"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input"
            type="number"
            min="1"
            step="1"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            placeholder="Amount"
            required
          />
          <input
            className="input"
            type="number"
            min="1"
            max="28"
            step="1"
            value={form.billingDay}
            onChange={(event) => setForm({ ...form, billingDay: event.target.value })}
            aria-label="Billing day"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={form.intervalMonths} onChange={(event) => setForm({ ...form, intervalMonths: event.target.value })}>
            <option value="1">Monthly</option>
            <option value="3">Quarterly</option>
            <option value="6">Half-yearly</option>
            <option value="12">Yearly</option>
          </select>
          <select className="input" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button className="btn-primary">Add subscription</button>
      </form>
      <div className="mt-4 space-y-2">
        {subscriptions.length === 0 ? (
          <p className="rounded-lg bg-slate-900/70 p-3 text-sm text-slate-400">No recurring subscriptions yet.</p>
        ) : (
          subscriptions.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg bg-slate-900/70 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{item.name}</p>
                <p className="text-xs text-slate-400">
                  Day {item.billingDay} - every {item.intervalMonths} month{item.intervalMonths === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums text-slate-100">{formatCurrency(item.amount)}</span>
              <button className="btn-danger px-2" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.name}`}>
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
