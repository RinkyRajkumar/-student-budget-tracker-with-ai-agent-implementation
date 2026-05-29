import { ArrowRight, BarChart3, Bell, Bot, Bus, CalendarDays, CreditCard, Grid2X2, Home, IndianRupee, LockKeyhole, PieChart, Plus, ReceiptText, RefreshCcw, ShieldCheck, ShoppingBag, Star, TrendingUp, Users, Utensils, WalletCards } from "lucide-react";
import { formatCurrency } from "../services/currency.js";
import SpendlyLogo from "./SpendlyLogo.jsx";

const features = [
  { icon: WalletCards, title: "Budget tracking", text: "Set a monthly budget and see spent, recurring, and remaining money instantly." },
  { icon: Plus, title: "Quick spending", text: "Add a spend from the dashboard with clean categories and payment methods." },
  { icon: CalendarDays, title: "Calendar expenses", text: "Open a monthly calendar where every day shows the amount spent." },
  { icon: RefreshCcw, title: "Recurring payments", text: "Track subscriptions, bills, due dates, reminders, and recurring totals." },
  { icon: BarChart3, title: "Spending analytics", text: "Review category breakdowns, trends, and frequent spending patterns." },
  { icon: LockKeyhole, title: "Secure profile", text: "Use email/password or Google login with Supabase authentication." }
];

const moneyRows = [
  { label: "Total budget", amount: 70000, icon: WalletCards, tone: "text-violet-200", bg: "bg-violet-500/15" },
  { label: "Spent this month", amount: 18450, icon: ReceiptText, tone: "text-amber-200", bg: "bg-amber-500/15" },
  { label: "Recurring amount", amount: 2300, icon: RefreshCcw, tone: "text-sky-200", bg: "bg-sky-500/15" },
  { label: "Remaining money", amount: 49250, icon: IndianRupee, tone: "text-emerald-300", bg: "bg-emerald-500/15" }
];

const trustStats = [
  { value: "10K+", label: "Happy Users", icon: Users, accent: "#8B5CF6" },
  { value: "₹50Cr+", label: "Money Managed", icon: TrendingUp, accent: "#22C55E" },
  { value: "99.9%", label: "Secure & Reliable", icon: ShieldCheck, accent: "#F97316" },
  { value: "4.8/5", label: "User Rating", icon: Star, accent: "#EC4899" }
];

const testimonials = [
  {
    name: "Aarav Sharma",
    role: "Computer Science Student",
    initials: "AS",
    accent: "#8B5CF6",
    review: "Spendly made it easy to see where my money goes every month. The budget and recurring payment tracking are super helpful."
  },
  {
    name: "Priya Nair",
    role: "Hostel Student",
    initials: "PN",
    accent: "#22C55E",
    review: "I like how simple the dashboard feels. I can track food, transport, subscriptions, and savings without feeling overwhelmed."
  },
  {
    name: "Rahul Mehta",
    role: "Engineering Student",
    initials: "RM",
    accent: "#3B82F6",
    review: "The upcoming bills and subscription reminders are my favorite part. I finally stopped forgetting small monthly payments."
  },
  {
    name: "Sneha Rao",
    role: "College Student",
    initials: "SR",
    accent: "#F97316",
    review: "The dark theme looks premium and the spending breakdown helps me control unnecessary expenses."
  },
  {
    name: "Arjun Patel",
    role: "Student Freelancer",
    initials: "AP",
    accent: "#EC4899",
    review: "Spendly helps me separate income, expenses, and savings goals clearly. It feels much better than using notes or spreadsheets."
  },
  {
    name: "Neha Thomas",
    role: "MBA Student",
    initials: "NT",
    accent: "#A855F7",
    review: "The app feels clean and student-friendly. I love the quick spending and budget overview cards."
  }
];

export default function LandingPage({ onNavigate }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070816] text-slate-100">
      <video
        className="landing-video-bg pointer-events-none absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      >
        <source src="/landing-money-bg.mp4" type="video/mp4" />
      </video>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(124,58,237,0.42),transparent_30rem),radial-gradient(circle_at_85%_18%,rgba(14,165,233,0.16),transparent_24rem),linear-gradient(180deg,rgba(7,8,22,0.78)_0%,rgba(17,24,39,0.90)_46%,rgba(7,8,22,0.98)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-violet-950/20 mix-blend-color" />
      <div className="relative z-10">
      <section className="landing-hero-screen flex min-h-screen flex-col">
        <nav className="mx-auto flex w-full max-w-7xl shrink-0 items-center justify-between px-4 py-5 md:px-6">
          <button className="flex items-center gap-2 text-left" onClick={() => onNavigate("/")}>
            <SpendlyLogo size="sm" animated />
          </button>
          <div className="flex items-center gap-2">
            <button className="btn-soft px-3" onClick={() => onNavigate("/login")}>Login</button>
            <button className="btn-primary px-3" onClick={() => onNavigate("/signup")}>Sign up</button>
          </div>
        </nav>

        <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-4 py-8 md:px-6 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="animate-landingFadeUp">
            <p className="mb-4 inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-sm font-semibold text-violet-200">
              Built for everyday money decisions
            </p>
            <h1 className="max-w-3xl text-4xl font-black tracking-normal text-white md:text-6xl">
              Budget smarter through every month.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Track spending, recurring payments, budgets, and smart insights in one calm dark dashboard for modern money management.
            </p>
            <div className="landing-hero-actions mt-9 flex flex-col gap-4 sm:flex-row sm:gap-[18px]">
              <button className="landing-cta-primary group" onClick={() => onNavigate("/signup")}>
                <span>Start free</span>
                <ArrowRight className="landing-cta-arrow" size={20} />
              </button>
              <button className="landing-cta-secondary" onClick={() => onNavigate("/login")}>I already have an account</button>
            </div>
          </div>
          <HeroProductVisual />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-start gap-4 px-4 py-8 md:grid-cols-[1.1fr_0.9fr] md:px-6">
        <div className="grid gap-4">
          <BudgetVisualization />
          <SafeSpendVisualization />
        </div>
        <div className="grid gap-4">
          <CalendarVisualization />
          <RecurringVisualization />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-violet-300">Everything in one place</p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Built for repeat daily use.</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-400">Spendly keeps the important money decisions visible without crowding your dashboard.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }, index) => (
            <article key={title} className="card landing-feature-card p-5 transition hover:-translate-y-1 hover:border-violet-400/40 hover:bg-slate-900/90" style={{ animationDelay: `${index * 70}ms` }}>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-violet-500/15 text-violet-200">
                <Icon size={20} />
              </div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-reviews-section mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase text-violet-300">Student reviews</p>
          <h2 className="mt-3 text-3xl font-black tracking-normal text-white md:text-4xl">Loved by students managing their money smarter</h2>
          <p className="mt-4 text-base leading-7 text-slate-400">
            Simple budgeting, recurring payment tracking, and spending insights — all in one calm dashboard.
          </p>
        </div>

        <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((review, index) => (
            <article key={review.name} className="landing-review-card" style={{ animationDelay: `${index * 80}ms` }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="landing-review-avatar" style={{ "--avatar-accent": review.accent }}>
                    {review.initials}
                  </div>
                  <div>
                    <h3>{review.name}</h3>
                    <p>{review.role}</p>
                  </div>
                </div>
                <div className="landing-rating" aria-label="5 star rating">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <Star key={starIndex} size={14} fill="currentColor" />
                  ))}
                </div>
              </div>
              <p className="landing-review-text">"{review.review}"</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <div className="landing-social-proof">
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-wide text-violet-300">Trusted by students</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-white md:text-4xl">Join thousands taking control of their money</h2>
          </div>
          <div className="landing-social-stats mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trustStats.map(({ value, label, icon: Icon, accent }, index) => (
              <div key={label} className="landing-social-stat" style={{ "--stat-accent": accent, animationDelay: `${index * 90}ms` }}>
                <div className="landing-social-icon">
                  <Icon size={29} fill={label === "User Rating" ? "none" : undefined} />
                </div>
                <div>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="landing-final-cta grid items-center gap-6 rounded-[28px] border border-violet-400/20 p-6 shadow-soft md:grid-cols-[0.72fr_1.28fr] md:p-8 lg:p-10">
          <WalletGraphic />
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-black tracking-normal text-white md:text-4xl">Ready to take control of your money?</h2>
            <p className="mt-3 text-base font-semibold text-slate-300 md:text-lg">Create your free account and start your journey toward financial freedom.</p>
            <div className="mt-7 flex flex-col items-center gap-4 sm:flex-row md:justify-start">
              <button className="landing-cta-primary group w-full sm:w-auto" onClick={() => onNavigate("/signup")}>
                <span>Create your free account</span>
                <ArrowRight className="landing-cta-arrow" size={21} />
              </button>
              <p className="text-base font-bold text-slate-400">No credit card required</p>
            </div>
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}

function WalletGraphic() {
  return (
    <div className="landing-wallet-graphic" aria-hidden="true">
      <span className="landing-star landing-star-one">✦</span>
      <span className="landing-star landing-star-two">✦</span>
      <span className="landing-star landing-star-three">✦</span>
      <div className="landing-wallet-shadow" />
      <div className="landing-wallet-card landing-wallet-card-one" />
      <div className="landing-wallet-card landing-wallet-card-two" />
      <div className="landing-wallet-card landing-wallet-card-three" />
      <div className="landing-wallet-body">
        <div className="landing-wallet-flap" />
        <span className="landing-wallet-button" />
      </div>
      <div className="landing-coin landing-coin-main">₹</div>
      <div className="landing-coin landing-coin-small" />
    </div>
  );
}

function HeroProductVisual() {
  const categories = [
    { label: "Food", amount: "₹4,650", icon: Utensils, className: "bg-orange-500/90" },
    { label: "Travel", amount: "₹3,240", icon: Bus, className: "bg-blue-500/90" },
    { label: "Bills", amount: "₹2,980", icon: ReceiptText, className: "bg-emerald-500/90" },
    { label: "Rent", amount: "₹12,000", icon: Home, className: "bg-amber-500/90" },
    { label: "Shopping", amount: "₹2,180", icon: ShoppingBag, className: "bg-violet-500/90" }
  ];

  const upcoming = [
    ["Spotify", "₹119"],
    ["Netflix", "₹649"],
    ["Google One", "₹130"]
  ];

  const chartPoints = [8, 15, 12, 23, 18, 31, 26, 38, 34, 48, 43, 57, 52, 68];

  return (
    <div className="landing-hero-visual animate-landingFadeUp" aria-label="Spendly dashboard and mobile app preview">
      <div className="landing-hero-glow" aria-hidden="true" />
      <div className="landing-desktop-preview">
        <div className="landing-desktop-sidebar">
          <span className="landing-sidebar-logo"><WalletCards size={18} /></span>
          {[Grid2X2, ReceiptText, BarChart3, WalletCards, RefreshCcw].map((Icon, index) => (
            <span key={index} className={index === 1 ? "active" : ""}>
              <Icon size={14} />
            </span>
          ))}
        </div>
        <div className="landing-desktop-main">
          <div className="landing-preview-header">
            <div>
              <p>Good Morning, Rinky 👋</p>
              <span>Everything in one calm place</span>
            </div>
            <button>This Month</button>
          </div>
          <div className="landing-preview-grid">
            <section className="landing-preview-card landing-current-card">
              <p className="landing-preview-kicker">Current Spend</p>
              <h3>₹18,450.00</h3>
              <span className="landing-positive">₹6k less than last month</span>
              <div className="landing-line-chart" aria-hidden="true">
                <svg viewBox="0 0 320 132" role="img">
                  <defs>
                    <linearGradient id="landingLineFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path className="landing-line-fill" d={`M 0 124 ${chartPoints.map((point, index) => `L ${index * 24} ${124 - point}`).join(" ")} L 312 124 Z`} />
                  <path className="landing-line-stroke" d={`M 0 124 ${chartPoints.map((point, index) => `L ${index * 24} ${124 - point}`).join(" ")}`} />
                </svg>
              </div>
            </section>
            <section className="landing-preview-card landing-budget-card">
              <p className="landing-preview-kicker">Budget Overview</p>
              <div className="landing-budget-row">
                <div>
                  <span>Remaining</span>
                  <strong>₹49,250</strong>
                  <small>of ₹70,000</small>
                </div>
                <div className="landing-mini-donut"><span>70%</span></div>
              </div>
            </section>
            <section className="landing-preview-card landing-categories-card">
              <div className="flex items-center justify-between">
                <p className="landing-preview-kicker">Top Categories</p>
                <button>View all</button>
              </div>
              <div className="landing-category-list">
                {categories.map(({ label, amount, icon: Icon, className }) => (
                  <div key={label}>
                    <span className={className}><Icon size={16} /></span>
                    <strong>{label}</strong>
                    <small>{amount}</small>
                  </div>
                ))}
              </div>
            </section>
            <section className="landing-preview-card landing-upcoming-card">
              <div className="flex items-center justify-between">
                <p className="landing-preview-kicker">Upcoming Bills</p>
                <button>Next 7 days</button>
              </div>
              <div className="mt-3 space-y-2">
                {upcoming.map(([name, amount]) => (
                  <div key={name} className="landing-upcoming-row">
                    <span>{name}</span>
                    <strong>{amount}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
      <div className="landing-phone-preview" aria-hidden="true">
        <div className="landing-phone-notch" />
        <div className="landing-phone-screen">
          <p>Hi, Rinky</p>
          <h3>₹18,450</h3>
          <div className="landing-phone-chart">
            {chartPoints.slice(3).map((point, index) => <span key={index} style={{ height: `${Math.max(16, point)}%` }} />)}
          </div>
          <div className="landing-phone-budget">
            <div>
              <span>Remaining</span>
              <strong>₹49,250</strong>
            </div>
            <div className="landing-mini-donut landing-phone-donut"><span>70%</span></div>
          </div>
          <div className="landing-phone-nav">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
      <p className="landing-handwritten">All your money<br />in one place.</p>
    </div>
  );
}

function BudgetVisualization() {
  return (
    <section className="card self-start p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-violet-300">Budget control</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal text-white">Know exactly where the month stands.</h2>
        </div>
        <PieChart className="text-violet-200" size={26} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[0.8fr_1fr]">
        <div className="grid place-items-center rounded-[24px] border border-white/10 bg-white/6 p-6">
          <div className="landing-donut relative grid h-44 w-44 place-items-center rounded-full">
            <div className="grid h-28 w-28 place-items-center rounded-full bg-slate-950 text-center">
              <span>
                <span className="block text-xs font-bold uppercase text-slate-500">Remaining</span>
                <span className="block text-xl font-black text-emerald-300">₹49,250</span>
              </span>
            </div>
          </div>
        </div>
        <div className="divide-y divide-white/10 rounded-[24px] border border-white/10 bg-white/6 px-4">
          {moneyRows.map(({ label, amount, icon: Icon, tone, bg }) => (
            <div key={label} className="flex items-center justify-between gap-3 py-4">
              <span className="flex items-center gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-2xl ${bg} ${tone}`}><Icon size={18} /></span>
                <span className="text-sm font-bold text-slate-200">{label}</span>
              </span>
              <span className={`text-sm font-black tabular-nums ${tone}`}>{formatCurrency(amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SafeSpendVisualization() {
  return (
    <section className="card landing-safe-spend-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-300">Safe to spend</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal text-white">₹1,680/day</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Based on ₹49,250 remaining for the rest of the month.
          </p>
        </div>
        <div className="landing-safe-meter" aria-hidden="true">
          <div>
            <strong>70%</strong>
            <small>left</small>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Food", "₹520", "Today"],
          ["Recurring", "₹2,300", "Planned"],
          ["Savings", "₹8,000", "Protected"]
        ].map(([label, value, helper]) => (
          <div key={label} className="landing-safe-chip">
            <span>{helper}</span>
            <strong>{value}</strong>
            <p>{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CalendarVisualization() {
  const days = [0, 120, 0, 540, 0, 199, 0, 0, 310, 0, 0, 880];
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-violet-300">Calendar view</p>
          <h2 className="mt-1 text-xl font-black">Daily spend at a glance</h2>
        </div>
        <CalendarDays className="text-violet-200" size={23} />
      </div>
      <div className="mt-4 grid grid-cols-6 gap-2">
        {days.map((amount, index) => (
          <div key={index} className={`landing-day rounded-2xl border p-2 ${amount ? "border-violet-300/35 bg-violet-500/20" : "border-white/10 bg-white/6"}`} style={{ animationDelay: `${index * 55}ms` }}>
            <p className="text-xs font-bold text-slate-500">{index + 1}</p>
            <p className={`mt-3 text-xs font-black ${amount ? "text-violet-100" : "text-slate-600"}`}>{amount ? formatCurrency(amount) : "₹0"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecurringVisualization() {
  const rows = [
    ["Spotify", "₹119", "Today"],
    ["Netflix", "₹649", "Fri"],
    ["Google One", "₹130", "Mon"]
  ];
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-violet-300">Recurring</p>
          <h2 className="mt-1 text-xl font-black">Never miss a renewal.</h2>
        </div>
        <Bell className="text-violet-200" size={23} />
      </div>
      <div className="mt-4 space-y-2">
        {rows.map(([name, amount, due], index) => (
          <div key={name} className="landing-recurring-row flex items-center justify-between rounded-2xl bg-white/8 p-3" style={{ animationDelay: `${index * 130}ms` }}>
            <span>
              <span className="block text-sm font-bold text-slate-100">{name}</span>
              <span className="text-xs text-slate-500">Due {due}</span>
            </span>
            <span className="text-sm font-black text-violet-100">{amount}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
