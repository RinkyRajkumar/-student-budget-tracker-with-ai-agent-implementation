import { ArrowLeft, ArrowRight, CalendarDays, Check, Goal, Plus, Sparkles, Trash2, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { saveOnboarding } from "../services/localAuth.js";
import SpendlyLoader from "./SpendlyLoader.jsx";

const categoryOptions = ["Food", "Transport", "Books", "Rent", "Tuition", "Entertainment", "Health", "Shopping", "Subscriptions", "Other"];
const totalSteps = 7;

const initialOnboardingData = {
  monthlyIncome: "",
  monthlyBudget: "",
  goalName: "",
  goalTargetAmount: "",
  targetDate: "",
  categories: ["Food", "Transport", "Books", "Subscriptions", "Other"],
  subscriptions: []
};

export default function OnboardingPage({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState("next");
  const [onboardingData, setOnboardingData] = useState(initialOnboardingData);
  const [subscription, setSubscription] = useState({ name: "", amount: "", billingCycle: "1", billingDay: "1" });
  const [isCompleting, setIsCompleting] = useState(false);

  const progress = useMemo(() => Math.round((step / totalSteps) * 100), [step]);
  const canContinue = isStepValid(step, onboardingData);

  function updateField(field, value) {
    setOnboardingData((current) => ({ ...current, [field]: value }));
  }

  function move(nextStep) {
    setDirection(nextStep > step ? "next" : "back");
    setStep(Math.min(totalSteps, Math.max(1, nextStep)));
  }

  function toggleCategory(category) {
    setOnboardingData((current) => {
      const exists = current.categories.includes(category);
      return {
        ...current,
        categories: exists ? current.categories.filter((item) => item !== category) : [...current.categories, category]
      };
    });
  }

  function addSubscription() {
    if (!subscription.name.trim() || !subscription.amount) return;
    setOnboardingData((current) => ({
      ...current,
      subscriptions: [
        ...current.subscriptions,
        {
          name: subscription.name.trim(),
          amount: Number(subscription.amount),
          billingCycle: Number(subscription.billingCycle),
          billingDay: Number(subscription.billingDay)
        }
      ]
    }));
    setSubscription({ name: "", amount: "", billingCycle: "1", billingDay: "1" });
  }

  function removeSubscription(index) {
    setOnboardingData((current) => ({
      ...current,
      subscriptions: current.subscriptions.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function finish() {
    if (!canContinue) return;
    const saved = saveOnboarding(onboardingData);
    localStorage.setItem("onboardingComplete", "true");
    setIsCompleting(true);
    window.setTimeout(() => onComplete(saved), 1000);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.30),transparent_34rem),linear-gradient(180deg,#070816_0%,#111827_56%,#070816_100%)] px-4 py-6 text-slate-100 md:py-10">
      <SpendlyLoader show={isCompleting} message="Preparing your dashboard..." />
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-5 md:grid-cols-[0.8fr_1.15fr]">
        <VisualPanel step={step} user={user} onboardingData={onboardingData} />

        <section className="card mx-auto w-full max-w-2xl overflow-hidden p-5 md:p-7">
          <div className="mb-7">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-violet-300">Step {step} of {totalSteps}</span>
              <span className="text-slate-500">{progress}% complete</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-violet-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div key={step} className={`min-h-[25rem] transition duration-300 ${direction === "next" ? "animate-slideInNext" : "animate-slideInBack"}`}>
            {step === 1 && <WelcomeStep user={user} onStart={() => move(2)} />}
            {step === 2 && (
              <IncomeStep
                value={onboardingData.monthlyIncome}
                onChange={(value) => updateField("monthlyIncome", value)}
              />
            )}
            {step === 3 && (
              <BudgetStep
                value={onboardingData.monthlyBudget}
                onChange={(value) => updateField("monthlyBudget", value)}
              />
            )}
            {step === 4 && (
              <SavingsStep
                data={onboardingData}
                onChange={updateField}
              />
            )}
            {step === 5 && (
              <CategoriesStep
                selected={onboardingData.categories}
                onToggle={toggleCategory}
              />
            )}
            {step === 6 && (
              <SubscriptionsStep
                subscription={subscription}
                setSubscription={setSubscription}
                subscriptions={onboardingData.subscriptions}
                onAdd={addSubscription}
                onRemove={removeSubscription}
                onSkip={() => move(7)}
              />
            )}
            {step === 7 && <FinishStep data={onboardingData} />}
          </div>

          {step > 1 && (
            <footer className="mt-7 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button className="btn-soft px-4" type="button" onClick={() => move(step - 1)}>
                <ArrowLeft size={16} />
                Back
              </button>
              {step < totalSteps ? (
                <button className="btn-primary px-5" type="button" onClick={() => move(step + 1)} disabled={!canContinue}>
                  Next
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button className="btn-primary px-5" type="button" onClick={finish} disabled={isCompleting}>
                  Finish setup
                  <Check size={16} />
                </button>
              )}
            </footer>
          )}
        </section>
      </div>
    </main>
  );
}

function VisualPanel({ step, user, onboardingData }) {
  return (
    <aside className="card hidden min-h-[34rem] overflow-hidden p-6 md:block">
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-violet-500/20 text-violet-200">
            <Sparkles size={22} />
          </div>
          <p className="mt-5 text-sm font-semibold text-violet-300">SpendWise setup</p>
          <h1 className="mt-2 text-4xl font-black tracking-normal text-white">A focused setup for {user?.name || "your"} budget.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            One decision at a time. Your dashboard will adapt to your budget limit, goals, spending categories, and recurring costs.
          </p>
        </div>
        <div className="space-y-3">
          <PreviewRow icon={WalletCards} label="Monthly budget" value={onboardingData.monthlyBudget ? `Rs ${onboardingData.monthlyBudget}` : "Not set"} active={step >= 3} />
          <PreviewRow icon={Goal} label="Savings goal" value={onboardingData.goalName || "Not set"} active={step >= 4} />
          <PreviewRow icon={CalendarDays} label="Categories" value={`${onboardingData.categories.length} selected`} active={step >= 5} />
        </div>
      </div>
    </aside>
  );
}

function PreviewRow({ icon: Icon, label, value, active }) {
  return (
    <div className={`rounded-lg border p-4 ${active ? "border-violet-400/30 bg-violet-500/10" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-violet-200">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="truncate text-sm font-bold text-slate-100">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StepHeader({ eyebrow, title, helper }) {
  return (
    <div>
      <p className="text-sm font-semibold text-violet-300">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black tracking-normal text-white md:text-4xl">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">{helper}</p>
    </div>
  );
}

function WelcomeStep({ user, onStart }) {
  return (
    <div className="flex min-h-[25rem] flex-col justify-center">
      <StepHeader
        eyebrow="Welcome"
        title={`Hi ${user?.name || "there"}.`}
        helper="Let's personalize your budget dashboard."
      />
      <button className="btn-primary mt-8 w-full py-3 sm:w-fit sm:px-6" type="button" onClick={onStart}>
        Start setup
        <ArrowRight size={17} />
      </button>
    </div>
  );
}

function IncomeStep({ value, onChange }) {
  return (
    <div className="flex min-h-[25rem] flex-col justify-center">
      <StepHeader
        eyebrow="Income"
        title="What is your monthly income?"
        helper="This helps calculate your safe-to-spend amount."
      />
      <input className="input mt-8 max-w-md py-3 text-lg" type="number" min="1" placeholder="Example: 30000" value={value} onChange={(event) => onChange(event.target.value)} autoFocus />
    </div>
  );
}

function BudgetStep({ value, onChange }) {
  return (
    <div className="flex min-h-[25rem] flex-col justify-center">
      <StepHeader
        eyebrow="Monthly budget"
        title="Set your spending limit."
        helper="Set the maximum amount you want to spend this month."
      />
      <input className="input mt-8 max-w-md py-3 text-lg" type="number" min="1" placeholder="Example: 18000" value={value} onChange={(event) => onChange(event.target.value)} autoFocus />
    </div>
  );
}

function SavingsStep({ data, onChange }) {
  return (
    <div className="flex min-h-[25rem] flex-col justify-center">
      <StepHeader
        eyebrow="Savings goal"
        title="What are you saving for?"
        helper="Add a clear goal so your dashboard can show progress every month."
      />
      <div className="mt-8 grid gap-4">
        <label className="block text-sm font-semibold text-slate-300">
          Goal name
          <input className="input mt-2 py-3" placeholder="New laptop, trip, emergency fund" value={data.goalName} onChange={(event) => onChange("goalName", event.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-300">
            Target amount
            <input className="input mt-2 py-3" type="number" min="1" placeholder="Example: 50000" value={data.goalTargetAmount} onChange={(event) => onChange("goalTargetAmount", event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-slate-300">
            Target date <span className="font-normal text-slate-500">(optional)</span>
            <input className="input mt-2 py-3" type="date" value={data.targetDate} onChange={(event) => onChange("targetDate", event.target.value)} />
          </label>
        </div>
      </div>
    </div>
  );
}

function CategoriesStep({ selected, onToggle }) {
  return (
    <div className="flex min-h-[25rem] flex-col justify-center">
      <StepHeader
        eyebrow="Expense categories"
        title="Choose what you want to track."
        helper="Select every category that should appear in your dashboard and expense form."
      />
      <div className="mt-8 flex flex-wrap gap-3">
        {categoryOptions.map((category) => {
          const active = selected.includes(category);
          return (
            <button key={category} type="button" className={active ? "btn-primary px-4 py-3" : "btn-soft px-4 py-3"} onClick={() => onToggle(category)}>
              {active && <Check size={16} />}
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SubscriptionsStep({ subscription, setSubscription, subscriptions, onAdd, onRemove, onSkip }) {
  return (
    <div className="flex min-h-[25rem] flex-col justify-center">
      <StepHeader
        eyebrow="Optional subscriptions"
        title="Add recurring payments now?"
        helper="Track services like Spotify, Netflix, study apps, meal plans, or gym memberships. You can skip this and add them later."
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_0.65fr]">
        <input className="input py-3" placeholder="Subscription name" value={subscription.name} onChange={(event) => setSubscription({ ...subscription, name: event.target.value })} />
        <input className="input py-3" type="number" min="1" placeholder="Amount" value={subscription.amount} onChange={(event) => setSubscription({ ...subscription, amount: event.target.value })} />
        <select className="input py-3" value={subscription.billingCycle} onChange={(event) => setSubscription({ ...subscription, billingCycle: event.target.value })}>
          <option value="1">Monthly</option>
          <option value="3">Quarterly</option>
          <option value="6">Half-yearly</option>
          <option value="12">Yearly</option>
        </select>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <input className="input py-3" type="number" min="1" max="28" placeholder="Billing day" value={subscription.billingDay} onChange={(event) => setSubscription({ ...subscription, billingDay: event.target.value })} />
          <button className="btn-soft px-4" type="button" onClick={onAdd} aria-label="Add subscription">
            <Plus size={18} />
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn-soft px-4" type="button" onClick={onSkip}>Skip for now</button>
      </div>
      {subscriptions.length > 0 && (
        <div className="mt-5 space-y-2">
          {subscriptions.map((item, index) => (
            <div key={`${item.name}-${index}`} className="flex items-center justify-between rounded-lg bg-white/8 px-3 py-2 text-sm">
              <span>{item.name} - Rs {item.amount} - every {item.billingCycle} month{item.billingCycle === 1 ? "" : "s"}</span>
              <button type="button" className="text-rose-200" onClick={() => onRemove(index)} aria-label={`Remove ${item.name}`}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinishStep({ data }) {
  return (
    <div className="flex min-h-[25rem] flex-col justify-center">
      <StepHeader
        eyebrow="Finish"
        title="Your dashboard is ready."
        helper="Review your setup. Finish will save this onboarding data locally and open your dashboard."
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <SummaryItem label="Income" value={`Rs ${data.monthlyIncome || 0}`} />
        <SummaryItem label="Budget" value={`Rs ${data.monthlyBudget || 0}`} />
        <SummaryItem label="Savings goal" value={data.goalName || "Not set"} />
        <SummaryItem label="Target amount" value={`Rs ${data.goalTargetAmount || 0}`} />
        <SummaryItem label="Categories" value={`${data.categories.length} selected`} />
        <SummaryItem label="Subscriptions" value={`${data.subscriptions.length} added`} />
      </div>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/8 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-bold text-slate-100">{value}</p>
    </div>
  );
}

function isStepValid(step, data) {
  if (step === 2) return Number(data.monthlyIncome) > 0;
  if (step === 3) return Number(data.monthlyBudget) > 0;
  if (step === 4) return data.goalName.trim().length > 0 && Number(data.goalTargetAmount) > 0;
  if (step === 5) return data.categories.length > 0;
  return true;
}
