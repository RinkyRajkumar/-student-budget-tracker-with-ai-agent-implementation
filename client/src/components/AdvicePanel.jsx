import { ArrowRight, Lightbulb, PiggyBank, ReceiptText, ShieldCheck, TrendingUp, WalletCards } from "lucide-react";
import { formatCurrency } from "../services/currency.js";

export default function AdvicePanel({ advice, summary = {}, categories = [], recurringTotal = 0, onNavigate }) {
  const monthlyBudget = Number(summary.monthlyBudget || 0);
  const monthlySpent = Number(summary.monthlyTotal || 0);
  const remainingBudget = Number(summary.remainingBudget ?? monthlyBudget - monthlySpent);
  const daysLeft = Math.max(1, Number(summary.daysRemaining || advice?.safeToSpend?.daysRemaining || 1));
  const safeToSpend = Number(summary.safeToSpendPerDay ?? remainingBudget / daysLeft);
  const budgetUsedPercent = monthlyBudget ? Math.round((monthlySpent / monthlyBudget) * 1000) / 10 : 0;
  const highestCategory = categories?.[0] || advice?.highestCategory;
  const highestPercent = highestCategory?.percent ?? (monthlySpent ? (Number(highestCategory?.total || highestCategory?.amount || 0) / monthlySpent) * 100 : 0);
  const suggestion = advice?.suggestions?.[0] || advice?.weeklyTip || "Set a small buffer for unplanned expenses.";
  const health = getBudgetHealth(budgetUsedPercent, remainingBudget);
  const safeHealth = getSafeSpendHealth(remainingBudget, safeToSpend);

  if (!categories?.length && !monthlySpent && !monthlyBudget) {
    return (
      <section className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Lightbulb className="text-violet-300" size={20} />
              <h2 className="text-lg font-black tracking-normal text-white">Smart advice</h2>
            </div>
            <p className="mt-2 text-sm text-slate-400">Add more expenses to unlock smarter advice.</p>
          </div>
          <button className="btn-primary px-4 py-2" type="button" onClick={() => onNavigate?.("/dashboard")}>
            Add Spending
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    );
  }

  const cards = [
    {
      icon: WalletCards,
      title: "Safe to Spend",
      value: `${formatCurrency(Math.max(0, safeToSpend))}/day`,
      detail: `You can safely spend this amount for the next ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
      badge: safeHealth.label,
      tone: safeHealth.tone
    },
    {
      icon: TrendingUp,
      title: "Highest Spending Category",
      value: highestCategory?.name || highestCategory?.category || "No category yet",
      detail: highestCategory
        ? `${formatCurrency(highestCategory.total || highestCategory.amount)} spent, ${highestPercent.toFixed(1)}% of total spending.`
        : "Add expenses to identify your top category.",
      badge: highestCategory ? "Focus area" : "Pending",
      tone: "purple",
      action: "View Category",
      onAction: () => onNavigate?.("/spending")
    },
    {
      icon: ShieldCheck,
      title: "Budget Health",
      value: monthlyBudget ? `${budgetUsedPercent.toFixed(1)}% used` : "Budget not set",
      detail: monthlyBudget ? `You have used ${budgetUsedPercent.toFixed(1)}% of your monthly budget.` : "Set a monthly budget to track your health score.",
      badge: health.label,
      tone: health.tone
    },
    {
      icon: ReceiptText,
      title: "Recurring Cost Alert",
      value: formatCurrency(recurringTotal),
      detail: `Your recurring charges are ${formatCurrency(recurringTotal)} this month.`,
      badge: recurringTotal ? "Tracked" : "No recurring",
      tone: recurringTotal ? "sky" : "purple",
      action: "Manage Recurring",
      onAction: () => onNavigate?.("/subscriptions")
    },
    {
      icon: PiggyBank,
      title: "Suggested Action",
      value: "Next best move",
      detail: suggestion,
      badge: "Tip",
      tone: "purple",
      action: "Take Action",
      onAction: () => onNavigate?.("/budget")
    }
  ];

  return (
    <section className="card p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb className="text-violet-300" size={20} />
            <h2 className="text-lg font-black tracking-normal text-white">Smart advice</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">Actionable insights based on your budget, spending, and recurring charges.</p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Finance assistant</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <InsightCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}

function InsightCard({ icon: Icon, title, value, detail, badge, tone = "purple", action, onAction }) {
  const toneClasses = {
    healthy: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200 shadow-emerald-500/10",
    warning: "border-amber-300/20 bg-amber-400/10 text-amber-200 shadow-amber-500/10",
    danger: "border-rose-300/20 bg-rose-400/10 text-rose-200 shadow-rose-500/10",
    purple: "border-violet-300/20 bg-violet-400/10 text-violet-200 shadow-violet-500/10",
    sky: "border-sky-300/20 bg-sky-400/10 text-sky-200 shadow-sky-500/10"
  }[tone] || "border-violet-300/20 bg-violet-400/10 text-violet-200 shadow-violet-500/10";

  return (
    <article className="group rounded-[22px] border border-violet-400/35 bg-white/[0.035] p-4 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-violet-300/70 hover:bg-white/[0.055] hover:shadow-[0_18px_44px_rgba(139,92,246,0.14),inset_0_0_0_1px_rgba(196,181,253,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-2xl border shadow-lg transition group-hover:scale-105 ${toneClasses}`}>
          <Icon size={19} />
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${toneClasses}`}>
          {badge}
        </span>
      </div>
      <h3 className="mt-4 text-sm font-black text-slate-300">{title}</h3>
      <p className="mt-1 text-xl font-black tracking-normal text-white">{value}</p>
      <p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">{detail}</p>
      {action && (
        <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 text-xs font-black text-violet-100 transition hover:bg-violet-500/20" type="button" onClick={onAction}>
          {action}
          <ArrowRight size={14} />
        </button>
      )}
    </article>
  );
}

function getBudgetHealth(usedPercent, remainingBudget) {
  if (remainingBudget < 0 || usedPercent > 100) return { label: "Over Budget", tone: "danger" };
  if (usedPercent >= 70) return { label: "Warning", tone: "warning" };
  return { label: "Healthy", tone: "healthy" };
}

function getSafeSpendHealth(remainingBudget, safeToSpend) {
  if (remainingBudget < 0) return { label: "Over Budget", tone: "danger" };
  if (safeToSpend < 500) return { label: "Warning", tone: "warning" };
  return { label: "Healthy", tone: "healthy" };
}
