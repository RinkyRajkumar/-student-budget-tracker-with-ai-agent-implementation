export default function StatCard({ label, value, helper, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-950/80 border-white/10",
    mint: "bg-emerald-500/10 border-emerald-400/20",
    amber: "bg-amber-500/10 border-amber-400/20",
    rose: "bg-rose-500/10 border-rose-400/20",
    sky: "bg-violet-500/10 border-violet-400/20"
  };

  return (
    <section className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-normal text-ink">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{helper}</p>
    </section>
  );
}
