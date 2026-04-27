import { Pencil, Search, Trash2, Download } from "lucide-react";
import { formatCurrency } from "../services/currency.js";

export default function ExpenseList({
  expenses,
  categories,
  filters,
  setFilters,
  onEdit,
  onDelete,
  onExport
}) {
  return (
    <section className="card p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-normal">Expenses</h2>
          <p className="text-sm text-slate-400">Search and filter your spending history.</p>
        </div>
        <button className="btn-soft" onClick={onExport}>
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            className="input pl-9"
            placeholder="Search note"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
        </label>
        <select
          className="input"
          value={filters.categoryId}
          onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={filters.paymentMethod}
          onChange={(event) => setFilters({ ...filters, paymentMethod: event.target.value })}
        >
          <option value="">All payments</option>
          <option value="card">Card</option>
          <option value="cash">Cash</option>
          <option value="bank">Bank</option>
          <option value="upi">UPI</option>
          <option value="other">Other</option>
        </select>
        <input
          className="input"
          type="date"
          value={filters.from}
          onChange={(event) => setFilters({ ...filters, from: event.target.value })}
        />
      </div>

      <div className="mt-4 divide-y divide-white/10">
        {expenses.length === 0 ? (
          <div className="rounded-lg bg-slate-900/70 p-6 text-center text-sm text-slate-400">No expenses match the current filters.</div>
        ) : (
          expenses.map((expense) => (
            <div key={expense.id} className="grid min-h-14 grid-cols-[36px_1fr_auto] items-center gap-3 py-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: expense.categoryColor }}
                aria-hidden="true"
              />
              <button className="min-w-0 text-left" onClick={() => onEdit(expense)}>
                <p className="truncate text-sm font-semibold text-ink">{expense.note || expense.category}</p>
                <p className="text-xs text-slate-400">
                  {expense.date} - {expense.category} - {expense.paymentMethod}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <span className="min-w-20 text-right text-sm font-bold tabular-nums">{formatCurrency(expense.amount)}</span>
                <button className="btn-soft px-2" onClick={() => onEdit(expense)} aria-label="Edit expense">
                  <Pencil size={15} />
                </button>
                <button className="btn-danger px-2" onClick={() => onDelete(expense.id)} aria-label="Delete expense">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
