import { ArrowRight, Bot, CalendarDays, CreditCard, Goal, LayoutDashboard, Split, WalletCards } from "lucide-react";
import { formatCurrency } from "../services/currency.js";
import SpendlyLogo from "./SpendlyLogo.jsx";

const features = [
  { icon: WalletCards, title: "Budget tracking", text: "Track daily spending against a monthly student budget." },
  { icon: CalendarDays, title: "Calendar expenses", text: "See each day of the month with spending totals." },
  { icon: Goal, title: "Savings goals", text: "Plan for trips, gadgets, rent deposits, or emergency funds." },
  { icon: CreditCard, title: "Subscriptions", text: "Monitor Spotify, Netflix, study apps, and recurring costs." },
  { icon: Split, title: "Split bills", text: "Split shared food, hostel, and group expenses with friends." },
  { icon: Bot, title: "Smart advice", text: "Get practical suggestions based on categories and notes." }
];

export default function LandingPage({ onNavigate }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(124,58,237,0.32),transparent_30rem),linear-gradient(180deg,#070816_0%,#111827_52%,#070816_100%)] text-slate-100">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-6">
        <button className="flex items-center gap-2 text-left" onClick={() => onNavigate("/")}>
          <SpendlyLogo size="sm" />
        </button>
        <div className="flex items-center gap-2">
          <button className="btn-soft px-3" onClick={() => onNavigate("/login")}>Login</button>
          <button className="btn-primary px-3" onClick={() => onNavigate("/signup")}>Sign up</button>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-8 md:grid-cols-[1fr_0.9fr] md:px-6 md:pb-20 md:pt-14">
        <div>
          <div className="mb-6">
            <SpendlyLogo size="lg" />
          </div>
          <p className="mb-4 inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-sm font-semibold text-violet-200">
            Built for student money decisions
          </p>
          <h1 className="max-w-3xl text-4xl font-black tracking-normal text-white md:text-6xl">
            Budget smarter through every semester.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Track expenses, subscriptions, savings goals, split bills, and AI-style advice in one calm dark dashboard.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button className="btn-primary px-5 py-3" onClick={() => onNavigate("/signup")}>
              Start free <ArrowRight size={18} />
            </button>
            <button className="btn-soft px-5 py-3" onClick={() => onNavigate("/login")}>I already have an account</button>
          </div>
        </div>

        <DashboardPreview />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="card p-5 transition hover:-translate-y-1 hover:border-violet-400/40 hover:bg-slate-900/90">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-violet-500/15 text-violet-200">
                <Icon size={20} />
              </div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="rounded-lg border border-violet-400/20 bg-violet-500/10 p-6 text-center shadow-soft md:p-10">
          <h2 className="text-3xl font-black tracking-normal">Ready to control your monthly spending?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">Create your profile, set your budget, choose your categories, and land directly in your personal dashboard.</p>
          <button className="btn-primary mt-6 px-5 py-3" onClick={() => onNavigate("/signup")}>
            Create account <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </main>
  );
}

function DashboardPreview() {
  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-violet-300">Dashboard preview</p>
          <h2 className="text-xl font-bold">May spending</h2>
        </div>
        <LayoutDashboard className="text-violet-200" size={22} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-white/8 p-4">
          <p className="text-sm text-slate-400">Left this month</p>
          <p className="mt-2 text-2xl font-black">{formatCurrency(18450)}</p>
        </div>
        <div className="rounded-lg bg-white/8 p-4">
          <p className="text-sm text-slate-400">Safe per day</p>
          <p className="mt-2 text-2xl font-black">{formatCurrency(1180)}</p>
        </div>
      </div>
      <div className="mt-4 h-36 rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(139,92,246,0.28),rgba(14,165,233,0.16))] p-4">
        <div className="flex h-full items-end gap-2">
          {[35, 64, 42, 88, 58, 72, 46, 80].map((height, index) => (
            <span key={index} className="flex-1 rounded-t bg-violet-300/80" style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
