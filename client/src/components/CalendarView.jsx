import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { buildCalendarDays, formatMonthLabel, localDateString } from "../services/dates.js";
import { formatCurrency } from "../services/currency.js";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarView({
  month,
  expenses,
  selectedDate,
  onMonthChange,
  onToday,
  onDateSelect,
  onEditExpense
}) {
  const today = localDateString();

  const byDate = useMemo(() => {
    return expenses.reduce((acc, expense) => {
      if (!acc[expense.date]) acc[expense.date] = { total: 0, expenses: [] };
      acc[expense.date].total += expense.amount;
      acc[expense.date].expenses.push(expense);
      return acc;
    }, {});
  }, [expenses]);

  const monthTotal = expenses.reduce((total, expense) => total + expense.amount, 0);
  const days = buildCalendarDays(month);
  const selected = byDate[selectedDate] || { total: 0, expenses: [] };

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-violet-300">Calendar view</p>
          <h2 className="text-xl font-bold tracking-normal text-ink">{formatMonthLabel(month)}</h2>
          <p className="text-sm text-slate-400">{formatCurrency(monthTotal)} spent this month</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-soft px-3" onClick={() => onMonthChange(-1)} aria-label="Previous month">
            <ChevronLeft size={17} />
          </button>
          <button className="btn-soft" onClick={onToday}>
            Today
          </button>
          <button className="btn-soft px-3" onClick={() => onMonthChange(1)} aria-label="Next month">
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
        <div className="p-3 md:p-4">
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs font-semibold text-slate-400">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              if (day.empty) return <div key={day.key} className="min-h-20 rounded-lg bg-slate-900/40" />;

              const bucket = byDate[day.date];
              const isSelected = day.date === selectedDate;
              const isToday = day.date === today;
              const hasSpend = bucket?.total > 0;

              return (
                <button
                  key={day.key}
                  className={`min-h-20 rounded-lg border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                    isSelected
                      ? "border-violet-300 bg-violet-500 text-white"
                      : isToday
                        ? "border-violet-300 bg-violet-500/10"
                        : "border-white/10 bg-slate-900/70 hover:border-violet-300/60"
                  }`}
                  onClick={() => onDateSelect(day.date)}
                >
                  <span className={`text-xs font-bold ${isSelected ? "text-white" : "text-slate-400"}`}>
                    {day.day}
                  </span>
                  <span
                    className={`mt-3 block text-[11px] font-semibold tabular-nums sm:text-xs ${
                      isSelected ? "text-white" : hasSpend ? "text-slate-100" : "text-slate-500"
                    }`}
                  >
                    {formatCurrency(bucket?.total || 0)}
                  </span>
                  {hasSpend && (
                    <span className="mt-2 flex gap-1">
                      {bucket.expenses.slice(0, 3).map((expense) => (
                        <span
                          key={expense.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: isSelected ? "#ffffff" : expense.categoryColor }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="border-t border-white/10 bg-slate-950/60 p-4 lg:border-l lg:border-t-0">
          <p className="text-sm font-medium text-slate-400">Selected day</p>
          <h3 className="mt-1 text-lg font-bold tracking-normal text-ink">{selectedDate}</h3>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{formatCurrency(selected.total)}</p>

          <div className="mt-4 space-y-2">
            {selected.expenses.length === 0 ? (
              <div className="rounded-lg bg-slate-900/70 p-4 text-sm text-slate-400">No expenses recorded for this day.</div>
            ) : (
              selected.expenses.map((expense) => (
                <button
                  key={expense.id}
                  className="grid w-full grid-cols-[10px_1fr_auto] items-center gap-3 rounded-lg bg-slate-900/70 p-3 text-left shadow-sm transition hover:bg-slate-800"
                  onClick={() => onEditExpense(expense)}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: expense.categoryColor }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{expense.note || expense.category}</span>
                    <span className="text-xs text-slate-400">{expense.category} - {expense.paymentMethod}</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums text-ink">{formatCurrency(expense.amount)}</span>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
