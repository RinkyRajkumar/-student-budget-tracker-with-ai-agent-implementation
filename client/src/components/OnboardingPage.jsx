import { ArrowLeft, ArrowRight, CalendarDays, Check, Sparkles, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { saveOnboarding } from "../services/localAuth.js";
import SpendlyLoader from "./SpendlyLoader.jsx";

const categoryOptions = ["Food", "Transport", "Books", "Rent", "Tuition", "Entertainment", "Health", "Shopping", "Subscriptions", "Other"];
const totalSteps = 4;

const initialOnboardingData = {
  monthlyIncome: "0",
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
  const [isCompleting, setIsCompleting] = useState(false);
  const [finishError, setFinishError] = useState("");

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

  async function finish() {
    if (!canContinue) return;
    setFinishError("");
    try {
      setIsCompleting(true);
      const saved = await saveOnboarding(onboardingData);
      localStorage.setItem("onboardingComplete", "true");
      window.setTimeout(() => onComplete(saved), 1000);
    } catch (error) {
      setIsCompleting(false);
      setFinishError(error.message || "Could not save onboarding.");
    }
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
            {finishError && <p className="mb-4 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{finishError}</p>}
            {step === 1 && <WelcomeStep user={user} onStart={() => move(2)} />}
            {step === 2 && (
              <BudgetStep
                value={onboardingData.monthlyBudget}
                onChange={(value) => updateField("monthlyBudget", value)}
              />
            )}
            {step === 3 && (
              <CategoriesStep
                selected={onboardingData.categories}
                onToggle={toggleCategory}
              />
            )}
            {step === 4 && <FinishStep data={onboardingData} />}
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
            One decision at a time. Your dashboard will adapt to your budget limit, spending categories, and recurring costs.
          </p>
        </div>
        <div className="space-y-3">
          <PreviewRow icon={WalletCards} label="Monthly budget" value={onboardingData.monthlyBudget ? `Rs ${onboardingData.monthlyBudget}` : "Not set"} active={step >= 2} />
          <PreviewRow icon={CalendarDays} label="Categories" value={`${onboardingData.categories.length} selected`} active={step >= 3} />
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

function BudgetStep({ value, onChange }) {
  return (
    <div className="flex min-h-[25rem] flex-col justify-center">
      <StepHeader
        eyebrow="Monthly budget"
        title="What is your monthly budget?"
        helper="This will be added to your Budget page and used to calculate your remaining budget."
      />
      <input className="input mt-8 max-w-md py-3 text-lg" type="number" min="1" placeholder="Example: 18000" value={value} onChange={(event) => onChange(event.target.value)} autoFocus />
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

function FinishStep({ data }) {
  return (
    <div className="flex min-h-[25rem] flex-col justify-center">
      <StepHeader
        eyebrow="Finish"
        title="Your dashboard is ready."
        helper="Review your setup. Finish will save this onboarding data locally and open your dashboard."
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <SummaryItem label="Budget" value={`Rs ${data.monthlyBudget || 0}`} />
        <SummaryItem label="Categories" value={`${data.categories.length} selected`} />
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
  if (step === 2) return Number(data.monthlyBudget) > 0;
  if (step === 3) return data.categories.length > 0;
  return true;
}
