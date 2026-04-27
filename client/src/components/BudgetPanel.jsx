import { PiggyBank, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { formatCurrency } from "../services/currency.js";

export default function BudgetPanel({ budget, goal, summary, onBudgetSave, onGoalSave }) {
  const [budgetValue, setBudgetValue] = useState(budget.monthlyLimit || "");
  const [goalForm, setGoalForm] = useState(goal);

  useEffect(() => {
    setBudgetValue(budget.monthlyLimit || "");
  }, [budget.monthlyLimit]);

  useEffect(() => {
    setGoalForm(goal);
  }, [goal]);

  function budgetTone() {
    if (summary.budgetStatus === "over") return "bg-rose-500";
    if (summary.budgetStatus === "near") return "bg-amber-500";
    return "bg-mint";
  }

  return (
    <section className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <PiggyBank className="text-mint" size={20} />
          <h2 className="text-lg font-bold tracking-normal">Monthly budget</h2>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${budgetTone()}`}
            style={{ width: `${Math.min(100, summary.budgetUsedPercent || 0)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-slate-400">{summary.budgetUsedPercent.toFixed(1)}% used</span>
          <span className="font-semibold tabular-nums">{formatCurrency(summary.monthlyBudget)}</span>
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onBudgetSave(Number(budgetValue));
          }}
        >
          <input
            className="input"
            type="number"
            min="0"
            step="1"
            value={budgetValue}
            onChange={(event) => setBudgetValue(event.target.value)}
            aria-label="Monthly budget limit"
          />
          <button className="btn-primary">Save</button>
        </form>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2">
          <Target className="text-coral" size={20} />
          <h2 className="text-lg font-bold tracking-normal">Savings goal</h2>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-coral" style={{ width: `${Math.min(100, goal.progressPercent || 0)}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {formatCurrency(goal.currentAmount)} saved of {formatCurrency(goal.targetAmount)}
        </p>
        <form
          className="mt-4 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onGoalSave(goalForm);
          }}
        >
          <input
            className="input"
            value={goalForm.name || ""}
            onChange={(event) => setGoalForm({ ...goalForm, name: event.target.value })}
            placeholder="Goal name"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              value={goalForm.targetAmount || ""}
              onChange={(event) => setGoalForm({ ...goalForm, targetAmount: Number(event.target.value) })}
              aria-label="Target amount"
            />
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              value={goalForm.currentAmount || ""}
              onChange={(event) => setGoalForm({ ...goalForm, currentAmount: Number(event.target.value) })}
              aria-label="Current saved amount"
            />
          </div>
          <input
            className="input"
            type="date"
            value={goalForm.targetDate || ""}
            onChange={(event) => setGoalForm({ ...goalForm, targetDate: event.target.value })}
          />
          <button className="btn-primary">Update goal</button>
        </form>
      </div>
    </section>
  );
}
