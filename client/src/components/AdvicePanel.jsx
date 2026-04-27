import { FileText, Lightbulb, ShieldAlert, WalletCards } from "lucide-react";
import { formatCurrency } from "../services/currency.js";

export default function AdvicePanel({ advice }) {
  const alert = advice.alerts?.[0];
  const alertTone = {
    normal: "bg-emerald-500/10 text-emerald-200",
    medium: "bg-amber-500/10 text-amber-200",
    high: "bg-orange-500/10 text-orange-200",
    critical: "bg-rose-500/10 text-rose-200"
  }[alert?.level || "normal"];

  return (
    <section className="card p-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="text-amber-500" size={20} />
        <h2 className="text-lg font-bold tracking-normal">Smart advice</h2>
      </div>
      <div className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${alertTone}`}>
        {alert?.message || "Track a few expenses to get advice."}
      </div>
      <div className="mt-4 grid gap-3">
        <div className="rounded-lg bg-slate-900/70 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <WalletCards size={16} />
            Safe to spend
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(advice.safeToSpend?.perDay)}/day</p>
          <p className="text-sm text-slate-400">{advice.safeToSpend?.daysRemaining || 0} days remaining this month</p>
        </div>
        <div className="rounded-lg bg-violet-500/10 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert size={16} />
            Highest category
          </div>
          <p className="mt-1 text-sm text-slate-300">
            {advice.highestCategory
              ? `${advice.highestCategory.category}: ${formatCurrency(advice.highestCategory.amount)}`
              : "No category data yet."}
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-300">
        {(advice.suggestions || []).map((item) => (
          <li key={item} className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
      {!!advice.noteInsights?.length && (
        <div className="mt-4 rounded-lg border border-white/10 bg-slate-900/50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <FileText size={16} />
            Advice from your notes
          </div>
          <div className="mt-3 space-y-2">
            {advice.noteInsights.map((insight) => (
              <div key={insight.topic} className="rounded-lg bg-slate-950/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span>{insight.label}</span>
                  <span className="tabular-nums">{formatCurrency(insight.amount)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Found in {insight.count} note{insight.count === 1 ? "" : "s"}. {insight.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-4 rounded-lg bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-100">{advice.weeklyTip}</p>
    </section>
  );
}
