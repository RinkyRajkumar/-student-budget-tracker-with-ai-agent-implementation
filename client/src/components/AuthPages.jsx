import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { googleOAuthUrl, loginUser, resetPassword, signupUser } from "../services/localAuth.js";
import SpendlyLoader from "./SpendlyLoader.jsx";

export function LoginPage({ onNavigate, onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);
    try {
      const result = await loginUser(form);
      const user = result.user || result;
      window.setTimeout(() => onLogin(user, Boolean(result.onboardingComplete)), 1000);
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  }

  function loginWithGoogle() {
    setError("");
    setMessage("");
    setIsLoading(true);
  }

  async function forgotPassword() {
    setError("");
    setMessage("");
    try {
      const nextMessage = await resetPassword(form.email);
      setMessage(nextMessage);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Login to continue to your student budget dashboard." onNavigate={onNavigate}>
      <SpendlyLoader show={isLoading} message="Securing your budget space..." />
      <form className="space-y-4" onSubmit={submit}>
        {error && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
        {message && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{message}</p>}
        <label className="block text-sm font-semibold text-slate-300">Email<input className="input mt-2" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="block text-sm font-semibold text-slate-300">Password<input className="input mt-2" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <div className="-mt-2 flex justify-end">
          <button className="text-sm font-semibold text-violet-300 transition hover:text-violet-100" type="button" onClick={forgotPassword}>
            Forgot password?
          </button>
        </div>
        <button className="btn-primary w-full py-3" disabled={isLoading}>Login <ArrowRight size={17} /></button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <a className={`btn-soft w-full justify-center py-3 ${isLoading ? "pointer-events-none opacity-70" : ""}`} href={googleOAuthUrl()} onClick={loginWithGoogle}>
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-black text-slate-950">G</span>
        Continue with Google
      </a>
      <p className="mt-5 text-center text-sm text-slate-400">
        New here? <button className="font-semibold text-violet-300" onClick={() => onNavigate("/signup")}>Create an account</button>
      </p>
    </AuthShell>
  );
}

export function SignupPage({ onNavigate, onSignup }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const strength = getPasswordStrength(form.password);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    setIsLoading(true);
    try {
      const result = await signupUser(form);
      if (result.verificationSent) {
        setIsLoading(false);
        setMessage(result.message || "Verification email sent. Please check your Gmail inbox.");
        return;
      }
      onSignup(result.user || result);
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  }

  function signupWithGoogle() {
    setError("");
    setMessage("");
    setIsLoading(true);
  }

  return (
    <AuthShell title="Create your account" subtitle="Set up your profile before choosing your budget preferences." onNavigate={onNavigate}>
      <SpendlyLoader show={isLoading} message="Creating your Spendly space..." />
      <a className={`btn-soft mb-5 w-full justify-center py-3 ${isLoading ? "pointer-events-none opacity-70" : ""}`} href={googleOAuthUrl()} onClick={signupWithGoogle}>
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-black text-slate-950">G</span>
        Continue with Google
      </a>
      <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        or sign up with email
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <form className="space-y-4" onSubmit={submit}>
        {error && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
        {message && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{message}</p>}
        <label className="block text-sm font-semibold text-slate-300">Full name<input className="input mt-2" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="block text-sm font-semibold text-slate-300">Email<input className="input mt-2" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="block text-sm font-semibold text-slate-300">
          Password
          <input className="input mt-2" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {form.password && <PasswordStrengthMeter strength={strength} />}
        <label className="block text-sm font-semibold text-slate-300">Confirm password<input className="input mt-2" type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} /></label>
        <button className="btn-primary w-full py-3" disabled={isLoading}>Continue to onboarding <ArrowRight size={17} /></button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400">
        Already have an account? <button className="font-semibold text-violet-300" onClick={() => onNavigate("/login")}>Login</button>
      </p>
    </AuthShell>
  );
}

function PasswordStrengthMeter({ strength }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-400">Password strength</span>
        <span className={`text-xs font-black ${strength.textClass}`}>{strength.label}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className="h-2 overflow-hidden rounded-full bg-slate-800">
            <span
              className={`block h-full rounded-full transition-all duration-500 ease-out ${index < strength.level ? strength.barClass : "bg-transparent"}`}
              style={{ width: index < strength.level ? "100%" : "0%" }}
            />
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{strength.helper}</p>
    </div>
  );
}

function getPasswordStrength(password) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];
  const score = checks.filter(Boolean).length;
  if (score <= 1) return { level: 1, label: "Weak", helper: "Use at least 8 characters with more variety.", barClass: "bg-rose-400", textClass: "text-rose-300" };
  if (score === 2) return { level: 2, label: "Fair", helper: "Add a number or symbol to make it stronger.", barClass: "bg-amber-400", textClass: "text-amber-300" };
  if (score === 3) return { level: 3, label: "Good", helper: "Strong enough. A symbol can make it excellent.", barClass: "bg-violet-400", textClass: "text-violet-300" };
  return { level: 4, label: "Excellent", helper: "Great password strength for your Spendly account.", barClass: "bg-emerald-400", textClass: "text-emerald-300" };
}

function AuthShell({ title, subtitle, children, onNavigate }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.28),transparent_30rem),#070816] px-4 py-10 text-slate-100">
      <section className="w-full max-w-md">
        <button className="btn-soft mb-4 px-3" onClick={() => onNavigate("/")}>
          <ArrowLeft size={16} /> Home
        </button>
        <div className="card p-5 md:p-6">
          <h1 className="text-3xl font-black tracking-normal">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </main>
  );
}
