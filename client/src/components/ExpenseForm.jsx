import { Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { inferCategoryFromNote } from "../services/categoryInference.js";
import { localDateString } from "../services/dates.js";

const initialForm = {
  amount: "",
  categoryId: "",
  date: localDateString(),
  note: "",
  paymentMethod: "card"
};

export default function ExpenseForm({ categories, editing, selectedDate, onSubmit, onCancel }) {
  const [form, setForm] = useState(initialForm);
  const [autoCategory, setAutoCategory] = useState("");

  useEffect(() => {
    if (editing) {
      setForm({
        amount: editing.amount,
        categoryId: editing.categoryId,
        date: editing.date,
        note: editing.note,
        paymentMethod: editing.paymentMethod
      });
    } else {
      setForm((current) => ({ ...current, categoryId: current.categoryId || categories[0]?.id || "" }));
      setAutoCategory("");
    }
  }, [editing, categories]);

  useEffect(() => {
    if (!editing && selectedDate) {
      setForm((current) => ({ ...current, date: selectedDate }));
    }
  }, [editing, selectedDate]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateNote(value) {
    const inferred = inferCategoryFromNote(value, categories);
    setAutoCategory(inferred?.name || "");
    setForm((current) => ({
      ...current,
      note: value,
      categoryId: inferred?.id || current.categoryId
    }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit({ ...form, categoryId: Number(form.categoryId), amount: Number(form.amount) });
    if (!editing) setForm({ ...initialForm, date: selectedDate || localDateString(), categoryId: categories[0]?.id || "" });
  }

  return (
    <section className="card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-normal">{editing ? "Edit expense" : "Add expense"}</h2>
          <p className="text-sm text-slate-400">Calendar clicks update this date. Notes can auto-pick a category.</p>
        </div>
        {editing && (
          <button className="btn-soft px-3" onClick={onCancel} type="button">
            <X size={16} />
          </button>
        )}
      </div>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-medium text-slate-300">
          Amount
          <input
            className="input mt-1"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(event) => update("amount", event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-300">
          Category
          <select
            className="input mt-1"
            value={form.categoryId}
            onChange={(event) => update("categoryId", event.target.value)}
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-300">
          Date
          <input
            className="input mt-1"
            type="date"
            value={form.date}
            onChange={(event) => update("date", event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-300">
          Payment
          <select
            className="input mt-1"
            value={form.paymentMethod}
            onChange={(event) => update("paymentMethod", event.target.value)}
          >
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="upi">UPI</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-300 sm:col-span-2">
          Note
          <input
            className="input mt-1"
            maxLength={180}
            placeholder="Spotify, Netflix, lunch, metro, lab notebook"
            value={form.note}
            onChange={(event) => updateNote(event.target.value)}
          />
          {autoCategory && <span className="mt-1 block text-xs text-violet-300">Auto-sorted as {autoCategory}</span>}
        </label>
        <button className="btn-primary sm:col-span-2">
          {editing ? <Save size={17} /> : <Plus size={17} />}
          {editing ? "Save expense" : "Add expense"}
        </button>
      </form>
    </section>
  );
}
